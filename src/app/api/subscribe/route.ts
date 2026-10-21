import { type NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/site';
import { upsertSubscription, deleteSubscription } from '@/lib/subscription';
import { buildDeviceInfo } from '@/lib/deviceInfo';
import { lookupGeo } from '@/lib/geoip';
import { clientIp } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  if (!rateLimit(`subscribe:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts, try again in a minute.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const subscription = body?.subscription;

  if (!slug || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription payload.' }, { status: 400 });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    return NextResponse.json({ error: 'Unknown site.' }, { status: 404 });
  }

  const ip = clientIp(req);
  const deviceInfo = buildDeviceInfo(req.headers.get('user-agent'), body?.deviceHints);
  const geo = await lookupGeo(ip);

  await upsertSubscription({
    siteId: site._id,
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    deviceInfo,
    geo,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';

  if (!slug || !endpoint) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    return NextResponse.json({ error: 'Unknown site.' }, { status: 404 });
  }

  await deleteSubscription(site._id, endpoint);
  return NextResponse.json({ ok: true });
}
