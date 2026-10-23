import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addSiteLanguages } from './0003-add-site-languages.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('turns each Language mode into Languages and drops the mode', async () => {
  const db = (await getMongoClient()).db('languages-test');
  await db.collection('sites').insertMany([
    { slug: 'a-italian', language: 'it' },
    { slug: 'b-english', language: 'en' },
    { slug: 'c-both', language: 'both' },
    { slug: 'd-already', language: 'both', languages: ['en', 'it'] },
  ]);

  await addSiteLanguages.up(db);
  await addSiteLanguages.up(db);

  const sites = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, language: 1, languages: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(sites, [
    { slug: 'a-italian', languages: ['it'] },
    { slug: 'b-english', languages: ['en'] },
    { slug: 'c-both', languages: ['it', 'en'] },
    { slug: 'd-already', languages: ['en', 'it'] },
  ]);
});
