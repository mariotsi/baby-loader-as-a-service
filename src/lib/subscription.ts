import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';
import type { GeoLocation } from './geoip';
import type { DeviceInfo } from './deviceInfo';

export interface PushSubscriptionDoc {
  _id: ObjectId;
  tenantId: ObjectId;
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
  tenantId: ObjectId;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceInfo: DeviceInfo | null;
  geo: GeoLocation | null;
}

/** Keyed by (tenantId, endpoint): the same device re-subscribing just refreshes its record. */
export async function upsertSubscription(input: UpsertSubscriptionInput): Promise<void> {
  const col = await collection();
  const now = new Date();
  await col.updateOne(
    { tenantId: input.tenantId, endpoint: input.endpoint },
    {
      $set: {
        keys: input.keys,
        deviceInfo: input.deviceInfo,
        geo: input.geo,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        tenantId: input.tenantId,
        endpoint: input.endpoint,
        createdAt: now,
      },
    },
    { upsert: true }
  );
}

export async function deleteSubscription(tenantId: ObjectId, endpoint: string): Promise<void> {
  const col = await collection();
  await col.deleteOne({ tenantId, endpoint });
}

export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const col = await collection();
  await col.deleteOne({ endpoint });
}

export async function listSubscriptionsByTenant(tenantId: ObjectId): Promise<PushSubscriptionDoc[]> {
  const col = await collection();
  return col.find({ tenantId }).sort({ createdAt: -1 }).toArray();
}

export async function countSubscriptionsByTenant(tenantId: ObjectId): Promise<number> {
  const col = await collection();
  return col.countDocuments({ tenantId });
}
