import { type NextRequest, NextResponse } from 'next/server';
import { deliveryActivity, errorList, logActivity } from '@/lib/activityLog';
import { deliverNotification, parseNotification } from '@/lib/notificationDelivery';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import { countSubscriptionsBySite } from '@/lib/subscription';
import { surviveDisconnect } from '@/lib/surviveDisconnect';
import { webPushService } from '@/lib/webpush';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || '';
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const count = await countSubscriptionsBySite(access.owned.site.id);
  return NextResponse.json({ count });
}

/** Sends `{ slug, messages: { <lang>: { title?, body } } }` to every Subscription of the Site. The Birth notification goes out with the Birth (see birthChange.ts). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const who = { slug, userId: access.owned.owner.id };
  const push = webPushService();
  if (!push) {
    logActivity('notification.send', { ...who, ok: false, reason: 'pushNotConfigured' });
    return routeError(500, { code: 'pushNotConfigured' });
  }
  const parsed = parseNotification(body?.messages, access.owned.site.languages);
  if (!parsed.ok) {
    logActivity('notification.send', { ...who, ok: false, reason: 'invalid', errors: errorList(parsed.errors) });
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  const delivery = await surviveDisconnect(deliverNotification(access.owned, parsed.value, push));
  logActivity('notification.send', deliveryActivity(access.owned, delivery));
  return NextResponse.json(delivery);
}
