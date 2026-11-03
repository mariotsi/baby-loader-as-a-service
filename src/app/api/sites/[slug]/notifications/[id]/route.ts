import { type NextRequest, NextResponse } from 'next/server';
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
  const push = webPushService();
  if (!push) {
    return routeError(500, { code: 'pushNotConfigured' });
  }
  const result = await surviveDisconnect(finishNotification(access.owned, id, push));
  return result ? NextResponse.json(result) : routeError(404, { code: 'notFound' });
}
