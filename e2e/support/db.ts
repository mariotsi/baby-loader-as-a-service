import { type Collection, MongoClient } from 'mongodb';

/**
 * Direct access to the database of the deployment under test, which the
 * global setup names in E2E_MONGODB_URI and E2E_DB_NAME, for what no page
 * shows: a User's stored password hash.
 */
async function withUsers<T>(run: (users: Collection) => Promise<T>): Promise<T> {
  const uri = process.env.E2E_MONGODB_URI;
  const dbName = process.env.E2E_DB_NAME;
  if (!uri || !dbName) {
    throw new Error('E2E_MONGODB_URI or E2E_DB_NAME is unset: the global setup did not run');
  }
  const client = await new MongoClient(uri).connect();
  try {
    return await run(client.db(dbName).collection('users'));
  } finally {
    await client.close();
  }
}

export function storedPasswordHash(email: string): Promise<string | undefined> {
  return withUsers(async (users) => (await users.findOne({ email }))?.passwordHash);
}

export function setPasswordHash(email: string, passwordHash: string): Promise<void> {
  return withUsers(async (users) => {
    await users.updateOne({ email }, { $set: { passwordHash } });
  });
}
