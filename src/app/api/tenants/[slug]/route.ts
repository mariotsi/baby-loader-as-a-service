import { NextRequest, NextResponse } from 'next/server';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { parseSiteSettings } from '@/lib/siteSettings';
import { saveSiteSettings, toTenantDTO } from '@/lib/tenant';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  return NextResponse.json({ tenant: toTenantDTO(access.owned.site) });
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
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json({ tenant: toTenantDTO(saved) });
}
