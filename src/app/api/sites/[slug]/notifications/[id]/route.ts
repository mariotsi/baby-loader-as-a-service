import { type NextRequest, NextResponse } from 'next/server';
import { deliveryActivity, logActivity } from '@/lib/activityLog';
import { finishNotification } from '@/lib/notificationDelivery';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import { surviveDisconnect } from '@/lib/surviveDisconnect';
import { webPushService } from '@/lib/webpush';

/** Finish sending: sends a Notification to the Subscriptions it has not reached. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }
  const who = { slug, userId: access.owned.owner.id };
  const push = webPushService();
  if (!push) {
    logActivity('notification.finish', { ...who, ok: false, reason: 'pushNotConfigured' });
    return routeError(500, { code: 'pushNotConfigured' });
  }
  const result = await surviveDisconnect(finishNotification(access.owned, id, push));
  if (!result) {
    logActivity('notification.finish', { ...who, ok: false, reason: 'notFound' });
    return routeError(404, { code: 'notFound' });
  }
  logActivity('notification.finish', deliveryActivity(access.owned, result));
  return NextResponse.json(result);
}
