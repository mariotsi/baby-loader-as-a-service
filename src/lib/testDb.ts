import { MongoMemoryServer } from 'mongodb-memory-server';
import { getMongoClient } from './mongodb.ts';

/**
 * A throwaway MongoDB for tests that cross the persistence seam. Call it
 * before the first query: getDb reads MONGODB_URI lazily, so pointing it at
 * the in-memory server here is enough. The returned function closes both.
 */
export async function startTestDb(): Promise<() => Promise<void>> {
  const server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri();
  process.env.SESSION_SECRET ??= 'test-session-secret';
  return async () => {
    await (await getMongoClient()).close();
    await server.stop();
  };
}
