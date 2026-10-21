import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';

/**
 * A one-off change to the data, applied once per database by the first
 * process that starts on code containing it (see applyMigrations). Its `up`
 * must be safe to rerun, since a run cut short repeats it, and must leave
 * data the previous deployment's code still reads correctly: on Vercel the
 * previous deployment keeps serving while the new one starts, and an
 * instant rollback runs it on migrated data.
 */
export type Migration = {
  /** Unique and sortable, "0001-short-name": migrations run in this order. */
  id: string;
  up(db: Db): Promise<void>;
};

/**
 * One collection holds both the record of applied migrations, one document
 * per id, and the lock, a document whose _id no migration id can take.
 */
type MigrationDoc = { _id: string; appliedAt: Date } | { _id: typeof LOCK_ID; owner: string; expiresAt: Date };

export const MIGRATIONS_COLLECTION = 'migrations';
const LOCK_ID = '~lock';

export type MigrationOptions = {
  /** How long the lock outlives its holder, renewed while it works. */
  leaseMs?: number;
  /** How long to wait for another process's lock before failing. */
  waitMs?: number;
  pollMs?: number;
};

/**
 * Applies, in order, every migration this database has no record of, and
 * returns their ids. Processes starting together take a lock in the
 * database, so each migration runs once: the others wait for the holder,
 * find nothing left and return. A holder that dies without releasing it
 * stops renewing its lease, and the next process takes over once it
 * expires. A failing migration throws, stays unrecorded, and is retried by
 * the next call.
 */
export async function applyMigrations(
  db: Db,
  migrations: readonly Migration[],
  { leaseMs = 30_000, waitMs = 120_000, pollMs = 500 }: MigrationOptions = {}
): Promise<string[]> {
  assertOrdered(migrations);
  const collection = db.collection<MigrationDoc>(MIGRATIONS_COLLECTION);
  if ((await pending(collection, migrations)).length === 0) {
    return [];
  }

  const owner = randomUUID();
  const deadline = Date.now() + waitMs;
  while (!(await acquire(collection, owner, leaseMs))) {
    if (Date.now() > deadline) {
      throw new Error(`Gave up after ${waitMs} ms waiting for the migration lock on ${db.databaseName}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  let lost = false;
  const renewal = setInterval(() => {
    renew(collection, owner, leaseMs).then(
      (held) => {
        lost ||= !held;
      },
      () => {
        lost = true;
      }
    );
  }, leaseMs / 3);
  try {
    const applied: string[] = [];
    // Read again under the lock: the previous holder may have applied them.
    for (const migration of await pending(collection, migrations)) {
      if (lost) {
        throw new Error(`Lost the migration lock on ${db.databaseName} before ${migration.id}`);
      }
      await migration.up(db);
      await collection.insertOne({ _id: migration.id, appliedAt: new Date() });
      applied.push(migration.id);
      console.log(`Applied migration ${migration.id} to ${db.databaseName}`);
    }
    return applied;
  } finally {
    clearInterval(renewal);
    await collection.deleteOne({ _id: LOCK_ID, owner });
  }
}

function assertOrdered(migrations: readonly Migration[]) {
  migrations.forEach((migration, i) => {
    if (migration.id === LOCK_ID || (i > 0 && migrations[i - 1].id >= migration.id)) {
      throw new Error(`Migration ids must be unique and sorted: ${migration.id}`);
    }
  });
}

async function pending(collection: Collection<MigrationDoc>, migrations: readonly Migration[]) {
  const ids = migrations.map((migration) => migration.id);
  const applied = new Set(
    (await collection.find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id)
  );
  return migrations.filter((migration) => !applied.has(migration.id));
}

/**
 * Takes the lock when nobody holds it or the holder's lease expired. A live
 * lock matches no document, so the upsert inserts a second "~lock" and
 * fails on the duplicate _id.
 */
async function acquire(collection: Collection<MigrationDoc>, owner: string, leaseMs: number): Promise<boolean> {
  const now = new Date();
  try {
    await collection.updateOne(
      { _id: LOCK_ID, expiresAt: { $lte: now } },
      { $set: { owner, expiresAt: new Date(now.getTime() + leaseMs) } },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return false;
    }
    throw err;
  }
}

async function renew(collection: Collection<MigrationDoc>, owner: string, leaseMs: number): Promise<boolean> {
  const { matchedCount } = await collection.updateOne(
    { _id: LOCK_ID, owner },
    { $set: { expiresAt: new Date(Date.now() + leaseMs) } }
  );
  return matchedCount === 1;
}
