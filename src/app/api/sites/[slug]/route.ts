import { type NextRequest, NextResponse } from 'next/server';
import type { OwnedSite } from '@/lib/ownerAccess';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import { saveSiteSettings, toSiteDTO } from '@/lib/site';
import type { Birth } from '@/lib/siteSettings';
import { parseSiteSettings } from '@/lib/siteSettings';
import { customerMediaPrefix, getStorageProvider } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  return NextResponse.json({ site: toSiteDTO(access.owned.site) });
}

/** Replaces every Site setting; the body is the complete Site settings. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const parsed = parseSiteSettings(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  if (!validBirthMedia(parsed.value.birth, access.owned)) {
    return routeError(400, { code: 'invalidRequest' });
  }
  const saved = await saveSiteSettings(access.owned, parsed.value);
  if (!saved) {
    return routeError(404, { code: 'notFound' });
  }
  return NextResponse.json({ site: toSiteDTO(saved) });
}

function validBirthMedia(birth: Birth, owned: OwnedSite): boolean {
  if (birth.born) {
    for (const media of [birth.details.photo, birth.details.video]) {
      if (!media) {
        continue;
      }
      try {
        if (
          !media.key.startsWith(customerMediaPrefix(owned)) ||
          media.url !== getStorageProvider().publicUrl(media.key)
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }
  return true;
}
