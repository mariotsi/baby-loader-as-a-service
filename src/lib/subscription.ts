import { and, count, desc, eq } from 'drizzle-orm';
import webpush from 'web-push';
import { getDb, newId } from '../db/index.ts';
import { subscriptions } from '../db/schema.ts';
import type { DeviceInfo } from './deviceInfo.ts';
import type { GeoLocation } from './geoip.ts';
import type { Lang } from './i18n.ts';
import type { ParseResult, SiteSettingsError } from './siteSettings.ts';

export interface PushSubscriptionRecord {
  id: string;
  siteId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** The Public page's language when the Visitor opted in; null on Subscriptions older than the field. */
  lang: Lang | null;
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC. */
  updatedAt: string;
}

function fromRow({ p256dh, auth, ...row }: typeof subscriptions.$inferSelect): PushSubscriptionRecord {
  return { ...row, keys: { p256dh, auth } };
}

/** Longest push endpoint accepted or looked up. Real ones run to a few hundred characters. */
export const ENDPOINT_MAX = 2048;

/** A browser's push subscription that passed every rule. Only parseSubscription produces one. */
export type ValidSubscription = {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
} & { readonly __brand: 'ValidSubscription' };

/**
 * Parses the `PushSubscription.toJSON()` a Visitor's browser hands over.
 * The endpoint is a URL the server later POSTs to, so it must be https, carry
 * no credentials, and name a host rather than an IP address or localhost. The
 * keys pass when web-push could encrypt a payload for them: its own checks
 * decide, so the rule follows the library that sends. Other fields, such as
 * `expirationTime`, are ignored.
 */
export function parseSubscription(input: unknown): ParseResult<ValidSubscription> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: 'subscription', code: 'required' }] };
  }
  const errors: SiteSettingsError[] = [];
  const endpoint = parseEndpoint(input.endpoint, errors);
  const keys = isRecord(input.keys) ? input.keys : null;
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') {
    errors.push({ path: 'subscription.keys', code: 'required' });
  } else if (endpoint !== null && !encryptsFor(endpoint, p256dh, auth)) {
    errors.push({ path: 'subscription.keys', code: 'invalidFormat' });
  }
  if (errors.length > 0 || endpoint === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { endpoint, keys: { p256dh, auth } } as ValidSubscription };
}

function parseEndpoint(value: unknown, errors: SiteSettingsError[]): string | null {
  const path = 'subscription.endpoint';
  if (typeof value !== 'string' || value === '') {
    errors.push({ path, code: 'required' });
    return null;
  }
  if (value.length > ENDPOINT_MAX) {
    errors.push({ path, code: 'tooLong', params: { max: ENDPOINT_MAX } });
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push({ path, code: 'invalidFormat' });
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || !isNamedHost(url.hostname)) {
    errors.push({ path, code: 'invalidFormat' });
    return null;
  }
  return value;
}

/** A DNS name: not localhost, and not an IPv4 or IPv6 address (URL keeps IPv6 in brackets). */
function isNamedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.startsWith('[')) {
    return false;
  }
  return !/^[\d.]+$/.test(host);
}

/** Whether web-push accepts the keys: it encrypts a payload for them and builds the request, without sending it. */
function encryptsFor(endpoint: string, p256dh: string, auth: string): boolean {
  try {
    webpush.generateRequestDetails({ endpoint, keys: { p256dh, auth } }, 'check');
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface UpsertSubscriptionInput {
  siteId: string;
  subscription: ValidSubscription;
  lang: Lang | null;
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
}

/** Keyed by (siteId, endpoint): the same device re-subscribing just refreshes its record. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const now = new Date().toISOString();
  const { endpoint, keys } = input.subscription;
  const refreshed = {
    p256dh: keys.p256dh,
    auth: keys.auth,
    lang: input.lang,
    deviceInfo: input.deviceInfo,
    geo: input.geo,
    updatedAt: now,
  };
  await getDb()
    .insert(subscriptions)
    .values({ ...refreshed, id: newId(), siteId: input.siteId, endpoint, createdAt: now })
    .onConflictDoUpdate({ target: [subscriptions.siteId, subscriptions.endpoint], set: refreshed })
    .run();
}

export async function deleteSubscription(siteId: string, endpoint: string): Promise<void> {
  await getDb()
    .delete(subscriptions)
    .where(and(eq(subscriptions.siteId, siteId), eq(subscriptions.endpoint, endpoint)));
}

/** A push endpoint the push service reports gone is dead for every Site it was subscribed to. */
export async function deleteSubscriptionsByEndpoint(endpoint: string): Promise<void> {
  await getDb().delete(subscriptions).where(eq(subscriptions.endpoint, endpoint));
}

export async function listSubscriptionsBySite(siteId: string): Promise<PushSubscriptionRecord[]> {
  const rows = await getDb().query.subscriptions.findMany({
    where: eq(subscriptions.siteId, siteId),
    orderBy: desc(subscriptions.createdAt),
  });
  return rows.map(fromRow);
}

export async function countSubscriptionsBySite(siteId: string): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(subscriptions).where(eq(subscriptions.siteId, siteId));
  return row?.n ?? 0;
}

/** Whether this Site has a saved Subscription for the browser endpoint. */
export async function hasSubscription(siteId: string, endpoint: string): Promise<boolean> {
  const row = await getDb().query.subscriptions.findFirst({
    where: and(eq(subscriptions.siteId, siteId), eq(subscriptions.endpoint, endpoint)),
    columns: { id: true },
  });
  return !!row;
}
