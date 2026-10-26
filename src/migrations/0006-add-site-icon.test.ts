import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addSiteIcon } from './0006-add-site-icon.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('gives every Site without a Site icon the loading baby, keeping an emoji already picked', async () => {
  const db = (await getMongoClient()).db('site-icon-test');
  await db.collection('sites').insertMany([{ slug: 'a-none' }, { slug: 'b-emoji', icon: '🐣' }]);

  await addSiteIcon.up(db);
  await addSiteIcon.up(db);

  const sites = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, icon: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(sites, [
    { slug: 'a-none', icon: null },
    { slug: 'b-emoji', icon: '🐣' },
  ]);
});
