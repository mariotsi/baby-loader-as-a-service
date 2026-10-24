import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { getMongoClient } from '../lib/mongodb.ts';
import { startTestDb } from '../lib/testDb.ts';
import { addMilestoneEmojiAndLabels } from './0005-add-milestone-emoji-and-labels.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('puts each label under every Language of its Site and gives each Milestone an emoji', async () => {
  const db = (await getMongoClient()).db('milestone-labels-test');
  await db.collection('sites').insertMany([
    { slug: 'a-both', languages: ['it', 'en'], milestones: [{ label: 'Ecografia', date: '2026-03-01' }] },
    { slug: 'b-none', languages: ['en'], milestones: [] },
    {
      slug: 'c-already',
      languages: ['en'],
      milestones: [{ emoji: '🍼', label: { en: 'Scan', it: 'Ecografia' }, date: '2026-03-01' }],
    },
  ]);

  await addMilestoneEmojiAndLabels.up(db);
  await addMilestoneEmojiAndLabels.up(db);

  const sites = await db
    .collection('sites')
    .find({}, { projection: { _id: 0, slug: 1, milestones: 1 } })
    .sort({ slug: 1 })
    .toArray();
  assert.deepEqual(sites, [
    { slug: 'a-both', milestones: [{ emoji: '✨', label: { it: 'Ecografia', en: 'Ecografia' }, date: '2026-03-01' }] },
    { slug: 'b-none', milestones: [] },
    { slug: 'c-already', milestones: [{ emoji: '🍼', label: { en: 'Scan', it: 'Ecografia' }, date: '2026-03-01' }] },
  ]);
});
