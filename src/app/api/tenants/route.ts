import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUserId } from '@/lib/auth';
import { createTenant, listTenantsByOwner, toTenantDTO } from '@/lib/tenant';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const tenants = await listTenantsByOwner(new ObjectId(userId));
  return NextResponse.json({ tenants: tenants.map(toTenantDTO) });
}

export async function POST(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const babyName = typeof body?.babyName === 'string' ? body.babyName : '';
  const dueDate = typeof body?.dueDate === 'string' && body.dueDate ? body.dueDate : null;
  const language = ['it', 'en', 'both'].includes(body?.language) ? body.language : 'en';

  if (!babyName.trim()) {
    return NextResponse.json({ error: 'Baby name is required.' }, { status: 400 });
  }

  try {
    const tenant = await createTenant({
      slug,
      ownerId: new ObjectId(userId),
      babyName,
      dueDate,
      language,
      theme: { palette: body?.theme?.palette, font: body?.theme?.font },
      privacy: { showName: body?.privacy?.showName, showSex: body?.privacy?.showSex },
    });
    return NextResponse.json({ tenant: toTenantDTO(tenant) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
