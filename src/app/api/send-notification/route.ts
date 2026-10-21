import { NextRequest, NextResponse } from 'next/server';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { defaultNotificationTitle } from '@/lib/siteSettings';
import { listSubscriptionsBySite, countSubscriptionsBySite, deleteSubscriptionByEndpoint } from '@/lib/subscription';
import { ensureVapid, webpush } from '@/lib/webpush';
import { siteAddressPath } from '@/lib/address';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || '';
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const count = await countSubscriptionsBySite(access.owned.site._id);
  return NextResponse.json({ count });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const site = access.owned.site;

  if (!ensureVapid()) {
    return NextResponse.json({ error: 'VAPID keys are not configured on the server.' }, { status: 500 });
  }

  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : defaultNotificationTitle(site);
  const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!messageBody) {
    return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
  }
  const url = typeof body?.url === 'string' && body.url ? body.url : siteAddressPath(site.slug);

  const subscriptions = await listSubscriptionsBySite(site._id);
  const payload = JSON.stringify({ title, body: messageBody, url, tag: `site-${site.slug}` });

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
