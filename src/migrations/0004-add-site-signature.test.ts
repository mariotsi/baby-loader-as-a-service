import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addSiteSignature } from './0004-add-site-signature.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('leaves every Site without a Signature, keeping one already written', async () => {
  const db = (await getMongoClient()).db('signature-test');
  await db
    .collection('sites')
    .insertMany([{ slug: 'a-unsigned' }, { slug: 'b-signed', signature: { en: 'Stefania & Simone' } }]);

  await addSiteSignature.up(db);
  await addSiteSignature.up(db);

  const sites = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, signature: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(sites, [
    { slug: 'a-unsigned', signature: {} },
    { slug: 'b-signed', signature: { en: 'Stefania & Simone' } },
  ]);
});
