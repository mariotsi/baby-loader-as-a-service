import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addSitePageName } from './0004-add-site-page-name.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('leaves every Site without a Page name, keeping one already written', async () => {
  const db = (await getMongoClient()).db('page-name-test');
  await db
    .collection('sites')
    .insertMany([{ slug: 'a-unnamed' }, { slug: 'b-named', pageName: { en: 'Stefania & Simone' } }]);

  await addSitePageName.up(db);
  await addSitePageName.up(db);

  const sites = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, pageName: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(sites, [
    { slug: 'a-unnamed', pageName: {} },
    { slug: 'b-named', pageName: { en: 'Stefania & Simone' } },
  ]);
});
