import { type NextRequest, NextResponse } from 'next/server';
import { logActivity, siteWriteActivity } from '@/lib/activityLog';
import { saveSettings } from '@/lib/birthChange';
import { birthWriteDeps, birthWriteResponse } from '@/lib/birthChangeNext';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { toSiteDTO } from '@/lib/site';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  return NextResponse.json({ site: toSiteDTO(access.owned.site) });
}

/** Replaces every Site setting but the Birth, from `{ updatedAt, settings }`; the Birth has its own route. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const body = await req.json().catch(() => null);
  const result = await saveSettings(access.owned, body, birthWriteDeps());
  logActivity('site.saveSettings', siteWriteActivity(access.owned, result));
  return birthWriteResponse(result);
}
