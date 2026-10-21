import { ObjectId } from 'mongodb';
import type { DeviceInfo } from './deviceInfo';
import type { GeoLocation } from './geoip';
import { getDb } from './mongodb';

export interface PushSubscriptionDoc {
  _id: ObjectId;
  siteId: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
  createdAt: Date;
  updatedAt: Date;
}

async function collection() {
  const db = await getDb();
  return db.collection<PushSubscriptionDoc>('subscriptions');
}

export interface UpsertSubscriptionInput {
  siteId: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
}

/** Keyed by (siteId, endpoint): the same device re-subscribing just refreshes its record. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const col = await collection();
  const now = new Date();
  await col.updateOne(
    { siteId: input.siteId, endpoint: input.endpoint },
    {
      $set: {
        keys: input.keys,
        deviceInfo: input.deviceInfo,
        geo: input.geo,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        siteId: input.siteId,
        endpoint: input.endpoint,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function deleteSubscription(siteId: ObjectId, endpoint: string): Promise<void> {
  const col = await collection();
  await col.deleteOne({ siteId, endpoint });
}

export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const col = await collection();
  await col.deleteOne({ endpoint });
}

export async function listSubscriptionsBySite(siteId: ObjectId): Promise<PushSubscriptionDoc[]> {
  const col = await collection();
  return col.find({ siteId }).sort({ createdAt: -1 }).toArray();
}

export async function countSubscriptionsBySite(siteId: ObjectId): Promise<number> {
  const col = await collection();
  return col.countDocuments({ siteId });
}
