import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant';
import { listSubscriptionsByTenant, countSubscriptionsByTenant, deleteSubscriptionByEndpoint } from '@/lib/subscription';
import { ensureVapid, webpush } from '@/lib/webpush';

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

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('tenantSlug') || '';
  const result = await requireOwnedTenant(req, slug);
  if ('error' in result) {
    return result.error;
  }
  const count = await countSubscriptionsByTenant(result.tenant._id);
  return NextResponse.json({ count });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const tenantSlug = typeof body?.tenantSlug === 'string' ? body.tenantSlug : '';
  const result = await requireOwnedTenant(req, tenantSlug);
  if ('error' in result) {
    return result.error;
  }

  if (!ensureVapid()) {
    return NextResponse.json({ error: 'VAPID keys are not configured on the server.' }, { status: 500 });
  }

  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : result.tenant.babyName;
  const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
  }
  const url = typeof body?.url === 'string' && body.url ? body.url : '/';

  const subscriptions = await listSubscriptionsByTenant(result.tenant._id);
  const payload = JSON.stringify({ title, body: messageBody, url, tag: `tenant-${result.tenant.slug}` });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deleteSubscriptionByEndpoint(sub.endpoint);
          removed += 1;
        }
      }
    })
  );

  return NextResponse.json({ sent, removed, total: subscriptions.length });
}
