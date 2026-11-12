import { type NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { clientIp } from '@/lib/auth';
import { buildDeviceInfo } from '@/lib/deviceInfo';
import { lookupGeo } from '@/lib/geoip';
import { isLang } from '@/lib/i18n';
import { rateLimit } from '@/lib/rateLimit';
import { routeError } from '@/lib/routeError';
import { getSiteBySlug } from '@/lib/site';
import {
  deleteSubscription,
  hasSubscription,
  isPushEndpoint,
  subscriptionSchema,
  upsertSubscription,
} from '@/lib/subscription';

export async function POST(req: NextRequest) {
  if (!rateLimit(`subscribe:${clientIp(req)}`, 20, 60_000)) {
    logActivity('subscription.add', { ok: false, reason: 'rateLimited' });
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const subscription = subscriptionSchema.safeParse(body?.subscription);

  if (!slug || !subscription.success) {
    logActivity('subscription.add', { ok: false, reason: 'invalidRequest', slug });
    return routeError(400, { code: 'invalidRequest' });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    logActivity('subscription.add', { ok: false, reason: 'unknownSite', slug });
    return routeError(404, { code: 'unknownSite' });
  }

  const ip = clientIp(req);
  const deviceInfo = buildDeviceInfo(req.headers.get('user-agent'), body?.deviceHints);
  const geo = await lookupGeo(ip);
  const lang = isLang(body?.lang) && site.languages.includes(body.lang) ? body.lang : null;

  await upsertSubscription({
    siteId: site.id,
    subscription: subscription.data,
    lang,
    deviceInfo,
    geo,
  });
  logActivity('subscription.add', { ok: true, slug, lang });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug : '';
  const endpoint = body?.endpoint;

  if (!slug || !isPushEndpoint(endpoint)) {
    return routeError(400, { code: 'invalidRequest' });
  }

  const site = await getSiteBySlug(slug);
  if (!site) {
    return routeError(404, { code: 'unknownSite' });
  }

  await deleteSubscription(site.id, endpoint);
  logActivity('subscription.remove', { ok: true, slug });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!slug || !isPushEndpoint(endpoint)) {
    return routeError(400, { code: 'invalidRequest' });
  }
  const site = await getSiteBySlug(slug);
  if (!site) {
    return routeError(404, { code: 'unknownSite' });
  }
  return NextResponse.json(
    { subscribed: await hasSubscription(site.id, endpoint) },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
