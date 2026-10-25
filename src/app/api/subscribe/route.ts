import { type NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/auth';
import { buildDeviceInfo } from '@/lib/deviceInfo';
import { lookupGeo } from '@/lib/geoip';
import { isLang } from '@/lib/i18n';
import { rateLimit } from '@/lib/rateLimit';
import { routeError } from '@/lib/routeError';
import { getSiteBySlug } from '@/lib/site';
import { deleteSubscription, upsertSubscription } from '@/lib/subscription';

export async function POST(req: NextRequest) {
  if (!rateLimit(`subscribe:${clientIp(req)}`, 20, 60_000)) {
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const subscription = body?.subscription;

  if (!slug || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return routeError(400, { code: 'invalidRequest' });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    return routeError(404, { code: 'unknownSite' });
  }

  const ip = clientIp(req);
  const deviceInfo = buildDeviceInfo(req.headers.get('user-agent'), body?.deviceHints);
  const geo = await lookupGeo(ip);
  const lang = isLang(body?.lang) && site.languages.includes(body.lang) ? body.lang : null;

  await upsertSubscription({
    siteId: site._id,
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    lang,
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
    return routeError(400, { code: 'invalidRequest' });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    return routeError(404, { code: 'unknownSite' });
  }

  await deleteSubscription(site._id, endpoint);
  return NextResponse.json({ ok: true });
}
