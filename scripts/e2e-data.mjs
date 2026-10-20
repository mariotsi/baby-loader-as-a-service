#!/usr/bin/env node
// Writes and removes E2E test data. Run by the E2E suite's global setup and
// teardown, and by `npm run seed` for local demo data.
//
//   node scripts/e2e-data.mjs reset [--demo]   E2E fixtures back to their initial state (+ demo data)
//   node scripts/e2e-data.mjs demo             demo data only
//   node scripts/e2e-data.mjs cleanup <runId>  one run's Users and Sites, plus any run's older than a day
//
// Target: E2E_MONGODB_URI (or MONGODB_URI) and E2E_DB_NAME, or else the
// database the app itself would use with this environment (databaseName).
// testDataPolicy (src/lib/dbName.ts) decides what may be written there:
// nothing on production, fixtures only on staging.

import { MongoClient, ObjectId } from 'mongodb';
import { databaseName, testDataPolicy } from '../src/lib/dbName.ts';
import { hashPassword } from '../src/lib/password.ts';
import {
  DEMO_OWNERS,
  DEMO_SITES,
  FIXTURE_OWNERS,
  FIXTURE_SITES,
  RUN_PREFIX,
} from '../e2e/support/data.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function target() {
  const uri = process.env.E2E_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Set E2E_MONGODB_URI or MONGODB_URI');
  }
  const dbName = process.env.E2E_DB_NAME || databaseName(process.env);
  return { uri, dbName, policy: testDataPolicy(uri, dbName) };
}

function isoDate(daysFromNow, now) {
  return new Date(now.getTime() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

/** A Site document as createTenant and updateTenant (src/lib/tenant.ts) leave it. */
function siteDoc(spec, ownerId, now) {
  const born = spec.bornDaysAgo !== undefined;
  return {
    _id: new ObjectId(),
    slug: spec.slug,
    ownerId,
    createdAt: now,
    updatedAt: now,
    babyName: spec.babyName,
    sex: spec.sex,
    dueDate: spec.dueInDays === null ? null : isoDate(spec.dueInDays, now),
    birthDatetime: born ? new Date(now.getTime() - spec.bornDaysAgo * DAY_MS).toISOString() : null,
    weight: born ? (spec.weight ?? null) : null,
    lengthCm: born ? (spec.lengthCm ?? null) : null,
    birthMessage: born ? (spec.birthMessage ?? '') : '',
    birthMessageEn: '',
    milestones: (spec.milestones ?? []).map((m) => ({ label: m.label, date: isoDate(m.inDays, now) })),
    language: spec.language,
    theme: { palette: 'blush', font: 'inter' },
    privacy: { showName: spec.showName, showSex: spec.showSex },
    customDomain: null,
    customDomainVerified: false,
  };
}

/**
 * Deletes the given Owners and Sites, with the Subscribers of those Sites,
 * then inserts them afresh, so every run starts from the same state.
 */
async function resetData(db, owners, sites, password) {
  const emails = Object.values(owners);
  const slugs = sites.map((s) => s.slug);
  const old = await db.collection('tenants').find({ slug: { $in: slugs } }, { projection: { _id: 1 } }).toArray();
  await db.collection('subscriptions').deleteMany({ tenantId: { $in: old.map((t) => t._id) } });
  await db.collection('tenants').deleteMany({ slug: { $in: slugs } });
  await db.collection('users').deleteMany({ email: { $in: emails } });

  const now = new Date();
  const ownerIds = {};
  for (const [key, email] of Object.entries(owners)) {
    ownerIds[key] = new ObjectId();
    await db.collection('users').insertOne({
      _id: ownerIds[key],
      email,
      passwordHash: await hashPassword(password),
      createdAt: now,
    });
  }
  await db.collection('tenants').insertMany(sites.map((spec) => siteDoc(spec, ownerIds[spec.owner], now)));
}

/** Removes one run's Users and Sites, and those of any run older than a day. */
async function cleanup(db, runId) {
  const thisRun = `^${RUN_PREFIX}${runId}-`;
  const anyRun = `^${RUN_PREFIX}`;
  const stale = new Date(Date.now() - DAY_MS);
  const siteFilter = { $or: [{ slug: { $regex: thisRun } }, { slug: { $regex: anyRun }, createdAt: { $lt: stale } }] };
  const userFilter = { $or: [{ email: { $regex: thisRun } }, { email: { $regex: anyRun }, createdAt: { $lt: stale } }] };

  const sites = await db.collection('tenants').find(siteFilter, { projection: { _id: 1 } }).toArray();
  const subs = await db.collection('subscriptions').deleteMany({ tenantId: { $in: sites.map((s) => s._id) } });
  const tenants = await db.collection('tenants').deleteMany(siteFilter);
  const users = await db.collection('users').deleteMany(userFilter);
  return { users: users.deletedCount, sites: tenants.deletedCount, subscribers: subs.deletedCount };
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const { uri, dbName, policy } = target();
  const withDemo = command === 'demo' || (command === 'reset' && arg === '--demo');

  if (command === 'reset' || command === 'cleanup') {
    if (!policy.fixtures) {
      throw new Error(`Refusing to write test data to ${dbName}`);
    }
  }
  if (withDemo && !policy.demo) {
    throw new Error(`Refusing to write demo data to ${dbName}`);
  }
  if (command === 'cleanup' && !/^[a-z0-9]+$/.test(arg ?? '')) {
    throw new Error('Usage: node scripts/e2e-data.mjs cleanup <runId>');
  }
  if (!['reset', 'demo', 'cleanup'].includes(command)) {
    throw new Error('Usage: node scripts/e2e-data.mjs reset [--demo] | demo | cleanup <runId>');
  }

  const client = await new MongoClient(uri).connect();
  try {
    const db = client.db(dbName);
    if (command === 'reset') {
      await resetData(db, FIXTURE_OWNERS, FIXTURE_SITES, e2ePassword());
      console.log(`E2E fixtures reset in ${dbName}: ${FIXTURE_SITES.length} Sites.`);
    }
    if (withDemo) {
      await resetData(db, DEMO_OWNERS, DEMO_SITES, process.env.DEMO_PASSWORD || 'waiting-pages-demo');
      console.log(`Demo data reset in ${dbName}: ${DEMO_SITES.length} Sites.`);
    }
    if (command === 'cleanup') {
      const removed = await cleanup(db, arg);
      console.log(`Run ${arg} cleaned up in ${dbName}:`, removed);
    }
  } finally {
    await client.close();
  }
}

function e2ePassword() {
  const password = process.env.E2E_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('Set E2E_PASSWORD (at least 8 characters)');
  }
  return password;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
