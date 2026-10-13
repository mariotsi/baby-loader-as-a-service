#!/usr/bin/env node
// Run: npm run create-indexes
// Idempotent: creating an index that already exists with the same spec is a no-op.

const { MongoClient } = require('mongodb');

const INDEXES = {
  users: [{ key: { email: 1 }, unique: true }],
  tenants: [
    { key: { slug: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    // Most tenants have customDomain: null, so uniqueness applies only to set values.
    { key: { customDomain: 1 }, unique: true, partialFilterExpression: { customDomain: { $type: 'string' } } },
  ],
  subscriptions: [
    { key: { tenantId: 1, endpoint: 1 }, unique: true },
    { key: { tenantId: 1, createdAt: -1 } },
    { key: { endpoint: 1 } },
  ],
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set (expected in .env.local)');
  }
  const dbName = process.env.MONGODB_DB_NAME || 'waitingpages';
  const client = await new MongoClient(uri).connect();
  try {
    const db = client.db(dbName);
    for (const [collection, specs] of Object.entries(INDEXES)) {
      const names = await db.collection(collection).createIndexes(specs);
      console.log(`${dbName}.${collection}: ${names.join(', ')}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
