import { MongoClient, type Db } from 'mongodb';
import { databaseName } from './dbName.ts';
import { ensureIndexes } from './indexes.ts';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/**
 * This deployment's database (see databaseName). Every name it can produce
 * differs from baby-loader's "pushnotify", so the two apps never share
 * collections even on one cluster.
 */
export const DB_NAME = databaseName(process.env);

let indexesReady: Promise<void> | undefined;

/**
 * Lazy connection: a missing MONGODB_URI must fail on the first query, not on
 * module import, otherwise `next build` can't even collect route data when
 * the env var isn't available at build time.
 */
export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return Promise.reject(new Error('Please define MONGODB_URI in .env.local'));
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
 * The first call in each process creates any missing index, so a preview
 * deployment's brand-new database is ready on its first request. A failure is
 * logged and requests go on without the missing indexes.
 */
export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(DB_NAME);
  indexesReady ??= ensureIndexes(db).catch((err) => {
    console.error(`Creating indexes on ${DB_NAME} failed`, err);
  });
  await indexesReady;
  return db;
}
