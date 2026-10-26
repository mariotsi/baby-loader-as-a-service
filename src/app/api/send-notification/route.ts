import { type NextRequest, NextResponse } from 'next/server';
import { deliverNotification, parseNotification } from '@/lib/notificationDelivery';
import { requireOwnedSite } from '@/lib/ownerAccessNext';
import { routeError } from '@/lib/routeError';
import { countSubscriptionsBySite } from '@/lib/subscription';
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

/** Sends `{ slug, messages: { <lang>: { title?, body } } }` to every Subscription of the Site. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const access = await requireOwnedSite(req, slug);
  if ('error' in access) {
    return access.error;
  }

  const push = webPushService();
  if (!push) {
    return routeError(500, { code: 'pushNotConfigured' });
  }
  const parsed = parseNotification(body?.messages, access.owned.site.languages);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }
  return NextResponse.json(await deliverNotification(access.owned, parsed.value, push));
}
