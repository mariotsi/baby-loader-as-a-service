import { and, count, desc, eq } from 'drizzle-orm';
import webpush from 'web-push';
import * as z from 'zod/mini';
import { getDb, newId } from '../db/index.ts';
import { subscriptions } from '../db/schema.ts';
import type { DeviceInfo } from './deviceInfo.ts';
import type { GeoLocation } from './geoip.ts';
import type { Lang } from './i18n.ts';

export interface PushSubscriptionRecord {
  id: string;
  siteId: string;
  endpoint: PushEndpoint;
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

/**
 * Where a push service takes a Subscription's Notifications. The server
 * POSTs to it, so it is https, carries no credentials, and names a host, not
 * localhost or an IP address.
 */
export const pushEndpointSchema = z
  .string()
  .check(z.minLength(1), z.maxLength(ENDPOINT_MAX), z.refine(isPushServiceUrl))
  .brand<'PushEndpoint'>();
export type PushEndpoint = z.output<typeof pushEndpointSchema>;
export function isPushEndpoint(value: unknown): value is PushEndpoint {
  return pushEndpointSchema.safeParse(value).success;
}

/**
 * The `PushSubscription.toJSON()` a Visitor's browser hands over, reduced to
 * its endpoint and keys (other fields, such as `expirationTime`, are dropped).
 * The keys pass when web-push could encrypt a payload for them: its own
 * checks decide, so the rule follows the library that sends.
 */
export const subscriptionSchema = z
  .object({
    endpoint: pushEndpointSchema,
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  })
  .check(z.refine(({ endpoint, keys }) => encryptsFor(endpoint, keys.p256dh, keys.auth), { path: ['keys'] }))
  .brand<'ValidSubscription'>();
export type ValidSubscription = z.output<typeof subscriptionSchema>;
export function isValidSubscription(value: unknown): value is ValidSubscription {
  return subscriptionSchema.safeParse(value).success;
}

function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && !url.username && !url.password && isNamedHost(url.hostname);
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

export async function deleteSubscription(siteId: string, endpoint: PushEndpoint): Promise<void> {
  await getDb()
    .delete(subscriptions)
    .where(and(eq(subscriptions.siteId, siteId), eq(subscriptions.endpoint, endpoint)));
}

/** A push endpoint the push service reports gone is dead for every Site it was subscribed to. */
export async function deleteSubscriptionsByEndpoint(endpoint: PushEndpoint): Promise<void> {
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
export async function hasSubscription(siteId: string, endpoint: PushEndpoint): Promise<boolean> {
  const row = await getDb().query.subscriptions.findFirst({
    where: and(eq(subscriptions.siteId, siteId), eq(subscriptions.endpoint, endpoint)),
    columns: { id: true },
  });
  return !!row;
}
