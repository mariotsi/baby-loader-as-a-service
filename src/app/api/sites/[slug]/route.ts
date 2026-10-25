import { type NextRequest, NextResponse } from 'next/server';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import { saveSiteSettings, toSiteDTO } from '@/lib/site';
import { parseSiteSettings } from '@/lib/siteSettings';

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
  const saved = await saveSiteSettings(access.owned, parsed.value);
  if (!saved) {
    return routeError(404, { code: 'notFound' });
  }
  return NextResponse.json({ site: toSiteDTO(saved) });
}
