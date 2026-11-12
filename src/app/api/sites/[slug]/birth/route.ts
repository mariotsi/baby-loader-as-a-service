import type { NextRequest } from 'next/server';
import { logActivity, siteWriteActivity } from '@/lib/activityLog';
import { clearBirth, setBirth } from '@/lib/birthChange';
import { birthWriteDeps, birthWriteResponse } from '@/lib/birthChangeNext';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { surviveDisconnect } from '@/lib/surviveDisconnect';

/**
 * Sets the Birth from `{ updatedAt, babyName, sex, details, birthVideo }`.
 * Announcing it sends the Birth notification in the same request, and keeps
 * sending after a disconnect (ADR-0010).
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const body = await req.json().catch(() => null);
  const result = await surviveDisconnect(setBirth(access.owned, body, birthWriteDeps()));
  logActivity('site.setBirth', siteWriteActivity(access.owned, result));
  return birthWriteResponse(result);
}

/** Goes back to the Countdown, from `{ updatedAt }`. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const body = await req.json().catch(() => null);
  const result = await clearBirth(access.owned, body, birthWriteDeps());
  logActivity('site.clearBirth', siteWriteActivity(access.owned, result));
  return birthWriteResponse(result);
}
