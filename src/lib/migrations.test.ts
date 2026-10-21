import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { getMongoClient } from './mongodb.ts';
import { applyMigrations, MIGRATIONS_COLLECTION, type Migration } from './migrations.ts';
import { startTestDb } from './testDb.ts';

let stopDb: () => Promise<void>;
let dbCount = 0;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

/** A database of its own per test, so records and locks never leak between them. */
async function freshDb(): Promise<Db> {
  return (await getMongoClient()).db(`migrations-test-${++dbCount}`);
}

/** A migration that appends its id to the `log` collection, after an optional pause. */
function logging(id: string, delayMs = 0): Migration {
  return {
    id,
    async up(db) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await db.collection('log').insertOne({ id });
    },
  };
}

async function logged(db: Db): Promise<string[]> {
  return (await db.collection('log').find().sort({ _id: 1 }).toArray()).map((doc) => doc.id);
}

test('applyMigrations applies pending migrations in order, once', async () => {
  const db = await freshDb();
  const migrations = [logging('0001-a'), logging('0002-b')];
  assert.deepEqual(await applyMigrations(db, migrations), ['0001-a', '0002-b']);
  assert.deepEqual(await applyMigrations(db, migrations), []);
  assert.deepEqual(await logged(db), ['0001-a', '0002-b']);
});

test('applyMigrations applies only the migrations added since the last run', async () => {
  const db = await freshDb();
  await applyMigrations(db, [logging('0001-a')]);
  assert.deepEqual(await applyMigrations(db, [logging('0001-a'), logging('0002-b')]), ['0002-b']);
  assert.deepEqual(await logged(db), ['0001-a', '0002-b']);
});

test('applyMigrations ignores records of migrations this code does not have', async () => {
  const db = await freshDb();
  await applyMigrations(db, [logging('0001-a'), logging('0002-b')]);
  assert.deepEqual(await applyMigrations(db, [logging('0001-a')]), []);
});

test('processes starting together apply each migration once', async () => {
  const db = await freshDb();
  const migrations = [logging('0001-a', 50), logging('0002-b', 50)];
  const runs = await Promise.all([1, 2, 3].map(() => applyMigrations(db, migrations, { pollMs: 10 })));
  assert.deepEqual(runs.flat().sort(), ['0001-a', '0002-b']);
  assert.deepEqual(await logged(db), ['0001-a', '0002-b']);
});

test('a failing migration stays unrecorded, releases the lock and is retried', async () => {
  const db = await freshDb();
  let fail = true;
  const flaky: Migration = {
    id: '0002-flaky',
    async up(db) {
      if (fail) {
        throw new Error('boom');
      }
      await db.collection('log').insertOne({ id: '0002-flaky' });
    },
  };
  const migrations = [logging('0001-a'), flaky, logging('0003-c')];
  await assert.rejects(applyMigrations(db, migrations, { waitMs: 0 }), /boom/);
  assert.deepEqual(await logged(db), ['0001-a']);
  fail = false;
  assert.deepEqual(await applyMigrations(db, migrations, { waitMs: 0 }), ['0002-flaky', '0003-c']);
});

test('applyMigrations takes over a lock whose lease expired', async () => {
  const db = await freshDb();
  await db
    .collection<{ _id: string; owner: string; expiresAt: Date }>(MIGRATIONS_COLLECTION)
    .insertOne({ _id: '~lock', owner: 'crashed', expiresAt: new Date(Date.now() - 1000) });
  assert.deepEqual(await applyMigrations(db, [logging('0001-a')], { waitMs: 0 }), ['0001-a']);
});

test('the holder renews its lease while a migration outlasts it', async () => {
  const db = await freshDb();
  const migrations = [logging('0001-slow', 300)];
  const options = { leaseMs: 90, pollMs: 10 };
  const holder = applyMigrations(db, migrations, options);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const waiter = applyMigrations(db, migrations, options);
  assert.deepEqual([...(await holder), ...(await waiter)], ['0001-slow']);
  assert.deepEqual(await logged(db), ['0001-slow']);
});

test('applyMigrations gives up on a lock that stays held', async () => {
  const db = await freshDb();
  await db
    .collection<{ _id: string; owner: string; expiresAt: Date }>(MIGRATIONS_COLLECTION)
    .insertOne({ _id: '~lock', owner: 'busy', expiresAt: new Date(Date.now() + 60_000) });
  await assert.rejects(applyMigrations(db, [logging('0001-a')], { waitMs: 50, pollMs: 10 }), /migration lock/);
  assert.deepEqual(await logged(db), []);
});

test('applyMigrations refuses unsorted or duplicate ids', async () => {
  const db = await freshDb();
  await assert.rejects(applyMigrations(db, [logging('0002-b'), logging('0001-a')]), /sorted/);
  await assert.rejects(applyMigrations(db, [logging('0001-a'), logging('0001-a')]), /sorted/);
});
