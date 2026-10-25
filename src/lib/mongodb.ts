import { type Db, MongoClient } from 'mongodb';
import { MIGRATIONS } from '../migrations/index.ts';
import { mongoEnv } from './env.ts';
import { ensureIndexes } from './indexes.ts';
import { applyMigrations } from './migrations.ts';

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

let databaseReady: Promise<void> | undefined;

/**
 * Lazy connection: a missing MONGODB_URI must fail on the first query, not on
 * module import, otherwise `next build` can't even collect route data when
 * the env var isn't available at build time.
 */
export function getMongoClient(): Promise<MongoClient> {
  let uri: string;
  try {
    uri = mongoEnv().uri;
  } catch (err) {
    return Promise.reject(err);
  }

  if (process.env.NODE_ENV === 'development') {
    // In dev, reuse the connection across hot reloads
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect();
  }

  return clientPromise;
}

/**
 * The first call in each process prepares the database before any query
 * runs: it applies the pending migrations (src/migrations), then creates any
 * missing index, so a preview deployment's brand-new database is ready on
 * its first request. A failed migration fails the request, and the next
 * call tries again: code never runs on data it does not expect. A failed
 * index is logged and requests go on without it.
 */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  // This deployment's database (see databaseName). Every name it can produce
  // differs from baby-loader's "pushnotify", so the two apps never share
  // collections even on one cluster.
  const { dbName } = mongoEnv();
  const db = client.db(dbName);
  databaseReady ??= applyMigrations(db, MIGRATIONS).then(
    () =>
      ensureIndexes(db).catch((err) => {
        console.error(`Creating indexes on ${dbName} failed`, err);
      }),
    (err) => {
      databaseReady = undefined;
      throw err;
    }
  );
  await databaseReady;
  return db;
}
