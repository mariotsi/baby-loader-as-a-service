import { MongoClient, type Db } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

/**
 * Database name for this product. Deliberately distinct from baby-loader's
 * "pushnotify" database — even if the two apps ever pointed at the same
 * MongoDB cluster (they shouldn't; see README), they would still never read
 * or write each other's collections.
 */
export const DB_NAME = process.env.MONGODB_DB_NAME || 'waitingpages';

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

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(DB_NAME);
}
