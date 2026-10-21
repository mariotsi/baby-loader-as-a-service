import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId, type Db } from 'mongodb';
import { getMongoClient } from '../lib/mongodb.ts';
import { ensureIndexes } from '../lib/indexes.ts';
import { startTestDb } from '../lib/testDb.ts';
import { renameTenantsToSites } from './0001-rename-tenants-to-sites.ts';

let stopDb: () => Promise<void>;
let dbCount = 0;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

async function freshDb(): Promise<Db> {
  return (await getMongoClient()).db(`rename-test-${++dbCount}`);
}

/** A database in the shape the previous deployment left: `tenants`, `tenantId` and their indexes. */
async function legacyDb(): Promise<{ db: Db; siteId: ObjectId }> {
  const db = await freshDb();
  const siteId = new ObjectId();
  await db.collection('tenants').insertOne({ _id: siteId, slug: 'emma' });
  await db.collection('tenants').createIndex({ slug: 1 }, { unique: true });
  await db.collection('subscriptions').insertMany([
    { tenantId: siteId, endpoint: 'https://push.example/a' },
    { tenantId: siteId, endpoint: 'https://push.example/b' },
  ]);
  await db.collection('subscriptions').createIndexes([
    { key: { tenantId: 1, endpoint: 1 }, unique: true },
    { key: { tenantId: 1, createdAt: -1 } },
    { key: { endpoint: 1 } },
  ]);
  return { db, siteId };
}

async function collectionNames(db: Db): Promise<string[]> {
  return (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort();
}

test('moves Sites to `sites` with their indexes, and subscriptions to `siteId`', async () => {
  const { db, siteId } = await legacyDb();
  await renameTenantsToSites.up(db);

  assert.deepEqual(await collectionNames(db), ['sites', 'subscriptions']);
  assert.equal((await db.collection('sites').findOne({ slug: 'emma' }))?._id.equals(siteId), true);
  assert.ok((await db.collection('sites').indexes()).some((index) => index.name === 'slug_1'));

  const subscriptions = await db.collection('subscriptions').find().toArray();
  assert.ok(subscriptions.every((s) => s.siteId?.equals(siteId) && !('tenantId' in s)));
  assert.deepEqual(
    (await db.collection('subscriptions').indexes()).map((index) => index.name).sort(),
    ['_id_', 'endpoint_1']
  );
});

test('leaves a database the current indexes can be built on', async () => {
  const { db, siteId } = await legacyDb();
  await renameTenantsToSites.up(db);
  await ensureIndexes(db);

  // One device subscribed to two Sites: the old unique (tenantId, endpoint) index would reject this.
  await db.collection('subscriptions').insertOne({ siteId: new ObjectId(), endpoint: 'https://push.example/a' });
  assert.equal(await db.collection('subscriptions').countDocuments({ endpoint: 'https://push.example/a' }), 2);
  assert.equal(await db.collection('subscriptions').countDocuments({ siteId }), 2);
});

test('is safe to rerun, including after the previous deployment recreated an empty `tenants`', async () => {
  const { db } = await legacyDb();
  await renameTenantsToSites.up(db);
  await db.createCollection('tenants');
  await renameTenantsToSites.up(db);

  assert.equal(await db.collection('sites').countDocuments(), 1);
  assert.equal(await db.collection('subscriptions').countDocuments({ siteId: { $exists: true } }), 2);
});

test('does nothing on an empty database', async () => {
  const db = await freshDb();
  await renameTenantsToSites.up(db);
  assert.deepEqual(await collectionNames(db), []);
});

test('refuses to merge when both collections hold Sites', async () => {
  const db = await freshDb();
  await db.collection('tenants').insertOne({ slug: 'old' });
  await db.collection('sites').insertOne({ slug: 'new' });
  await assert.rejects(renameTenantsToSites.up(db), /merge them by hand/);
});
