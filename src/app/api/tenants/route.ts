import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/ownerAccessNext';
import { parseNewSite } from '@/lib/siteSettings';
import { createSite, listTenantsByOwner, toTenantDTO } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const access = requireUser(req);
  if ('error' in access) {
    return access.error;
  }
  const tenants = await listTenantsByOwner(access.user);
  return NextResponse.json({ tenants: tenants.map(toTenantDTO) });
}

export async function POST(req: NextRequest) {
  const access = requireUser(req);
  if ('error' in access) {
    return access.error;
  }

  const parsed = parseNewSite(await req.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  const created = await createSite(access.user, parsed.value);
  if (!created.ok) {
    return NextResponse.json({ errors: created.errors }, { status: 409 });
  }
  return NextResponse.json({ tenant: toTenantDTO(created.site) }, { status: 201 });
}
