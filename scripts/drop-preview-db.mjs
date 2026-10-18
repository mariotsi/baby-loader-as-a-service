#!/usr/bin/env node
// Drops the database of one Git branch's preview deployments.
// Run: MONGODB_URI=<non-production cluster> node scripts/drop-preview-db.mjs <branch>
// The GitHub workflow .github/workflows/drop-preview-db.yml runs it when a
// pull request closes or a branch is deleted.

import { MongoClient } from 'mongodb';
import { previewDbName } from '../src/lib/dbName.ts';

// Their deployments use MONGODB_DB_NAME, never a preview database, and
// previewDbName('staging') is the staging database's name.
const PROTECTED_BRANCHES = new Set(['main', 'staging']);

async function main() {
  const branch = process.argv[2];
  if (!branch) {
    throw new Error('Usage: node scripts/drop-preview-db.mjs <branch>');
  }
  if (PROTECTED_BRANCHES.has(branch)) {
    console.log(`Branch ${branch} has no preview database to drop.`);
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  const dbName = previewDbName(branch);
  const client = await new MongoClient(uri).connect();
  try {
    await client.db(dbName).dropDatabase();
    console.log(`Dropped ${dbName} (or it did not exist).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
