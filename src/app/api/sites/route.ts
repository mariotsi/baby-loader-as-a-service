import { type NextRequest, NextResponse } from 'next/server';
import { errorList, logActivity } from '@/lib/activityLog';
import { requireUser } from '@/lib/ownerAccessNext';
import { createSite, listSitesByOwner, toSiteDTO } from '@/lib/site';
import { parseNewSite } from '@/lib/siteSettings';

export async function GET(req: NextRequest) {
  const access = requireUser(req);
  if ('error' in access) {
    return access.error;
  }
  const sites = await listSitesByOwner(access.user);
  return NextResponse.json({ sites: sites.map(toSiteDTO) });
}

export async function POST(req: NextRequest) {
  const access = requireUser(req);
  if ('error' in access) {
    return access.error;
  }

  const parsed = parseNewSite(await req.json().catch(() => null));
  if (!parsed.ok) {
    logActivity('site.create', {
      ok: false,
      reason: 'invalid',
      userId: access.user.id,
      errors: errorList(parsed.errors),
    });
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  const created = await createSite(access.user, parsed.value);
  if (!created.ok) {
    logActivity('site.create', {
      ok: false,
      reason: 'invalid',
      userId: access.user.id,
      errors: errorList(created.errors),
    });
    return NextResponse.json({ errors: created.errors }, { status: 409 });
  }
  logActivity('site.create', { ok: true, userId: access.user.id, slug: created.site.slug });
  return NextResponse.json({ site: toSiteDTO(created.site) }, { status: 201 });
}
