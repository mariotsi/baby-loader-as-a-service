import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getTenantBySlug, updateTenant, toTenantDTO, type TenantUpdate } from '@/lib/tenant';

async function requireOwnedTenant(req: NextRequest, slug: string) {
  const userId = getSessionUserId(req);
  if (!userId) {
    return { error: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) } as const;
  }
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    return { error: NextResponse.json({ error: 'Not found.' }, { status: 404 }) } as const;
  }
  if (tenant.ownerId.toHexString() !== userId) {
    return { error: NextResponse.json({ error: 'Not authorized.' }, { status: 403 }) } as const;
  }
  return { tenant } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await requireOwnedTenant(req, slug);
  if ('error' in result) {
    return result.error;
  }
  return NextResponse.json({ tenant: toTenantDTO(result.tenant) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await requireOwnedTenant(req, slug);
  if ('error' in result) {
    return result.error;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const patch: TenantUpdate = {};
  if (typeof body.babyName === 'string') {
    patch.babyName = body.babyName.trim();
  }
  if (body.sex === 'female' || body.sex === 'male' || body.sex === 'unknown') {
    patch.sex = body.sex;
  }
  if (body.dueDate === null || typeof body.dueDate === 'string') {
    patch.dueDate = body.dueDate;
  }
  if (body.birthDatetime === null || typeof body.birthDatetime === 'string') {
    patch.birthDatetime = body.birthDatetime;
  }
  if (body.weight === null || typeof body.weight === 'number') {
    patch.weight = body.weight;
  }
  if (body.lengthCm === null || typeof body.lengthCm === 'number') {
    patch.lengthCm = body.lengthCm;
  }
  if (typeof body.birthMessage === 'string') {
    patch.birthMessage = body.birthMessage;
  }
  if (typeof body.birthMessageEn === 'string') {
    patch.birthMessageEn = body.birthMessageEn;
  }
  if (Array.isArray(body.milestones)) {
    patch.milestones = body.milestones
      .filter((m: unknown): m is { label: unknown; date: unknown } => !!m && typeof m === 'object')
      .map((m: { label: unknown; date: unknown }) => ({ label: String(m.label ?? ''), date: String(m.date ?? '') }))
      .filter((m: { label: string; date: string }) => m.label && m.date);
  }
  if (['it', 'en', 'both'].includes(body.language)) {
    patch.language = body.language;
  }
  if (body.theme && typeof body.theme === 'object') {
    patch.theme = { palette: String(body.theme.palette ?? result.tenant.theme.palette), font: String(body.theme.font ?? result.tenant.theme.font) };
  }
  if (body.privacy && typeof body.privacy === 'object') {
    patch.privacy = {
      showName: body.privacy.showName ?? result.tenant.privacy.showName,
      showSex: body.privacy.showSex ?? result.tenant.privacy.showSex,
    };
  }

  const updated = await updateTenant(result.tenant._id, patch);
  if (!updated) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json({ tenant: toTenantDTO(updated) });
}
