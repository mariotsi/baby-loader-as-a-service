import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addSiteTimezone } from './0002-add-site-timezone.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('gives Sites without a Timezone Europe/Rome and keeps the ones they have', async () => {
  const db = (await getMongoClient()).db('timezone-test');
  await db.collection('sites').insertMany([{ slug: 'old' }, { slug: 'tokyo', timezone: 'Asia/Tokyo' }]);

  await addSiteTimezone.up(db);
  await addSiteTimezone.up(db);

  const timezones = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, timezone: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(timezones, [
    { slug: 'old', timezone: 'Europe/Rome' },
    { slug: 'tokyo', timezone: 'Asia/Tokyo' },
  ]);
});
