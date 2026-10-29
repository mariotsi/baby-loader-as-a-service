import { and, count, desc, eq } from 'drizzle-orm';
import { getDb, newId } from '../db/index.ts';
import { subscriptions } from '../db/schema.ts';
import type { DeviceInfo } from './deviceInfo.ts';
import type { GeoLocation } from './geoip.ts';
import type { Lang } from './i18n.ts';

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

export interface UpsertSubscriptionInput {
  siteId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  lang: Lang | null;
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
}

/** Keyed by (siteId, endpoint): the same device re-subscribing just refreshes its record. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const now = new Date().toISOString();
  const refreshed = {
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    lang: input.lang,
    deviceInfo: input.deviceInfo,
    geo: input.geo,
    updatedAt: now,
  };
  await getDb()
    .insert(subscriptions)
    .values({ ...refreshed, id: newId(), siteId: input.siteId, endpoint: input.endpoint, createdAt: now })
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
