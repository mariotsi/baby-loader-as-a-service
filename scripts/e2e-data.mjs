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
import { applyMigrations } from '../src/lib/migrations.ts';
import { hashPassword } from '../src/lib/password.ts';
import { MIGRATIONS } from '../src/migrations/index.ts';
import { parseNewSite } from '../src/lib/siteSettings.ts';
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

/**
 * A Site document as createSite (src/lib/site.ts) stores it, its Site
 * settings validated by the same parseNewSite the app runs, so a fixture can
 * never hold settings the app would refuse.
 */
function siteDoc(spec, ownerId, now) {
  const born = spec.bornDaysAgo !== undefined;
  const parsed = parseNewSite(
    {
      slug: spec.slug,
      settings: {
        babyName: spec.babyName,
        sex: spec.sex,
        dueDate: spec.dueInDays === null ? null : isoDate(spec.dueInDays, now),
        birth: born
          ? {
              born: true,
              details: {
                datetime: new Date(now.getTime() - spec.bornDaysAgo * DAY_MS).toISOString(),
                weightGrams: spec.weight ?? null,
                lengthCm: spec.lengthCm ?? null,
                message: spec.birthMessage ?? {},
              },
            }
          : { born: false, details: null },
        milestones: (spec.milestones ?? []).map((m) => ({ label: m.label, date: isoDate(m.inDays, now) })),
        language: spec.language,
        theme: { palette: 'blush', font: 'inter' },
        privacy: { showName: spec.showName, showSex: spec.showSex },
      },
    },
    now
  );
  if (!parsed.ok) {
    throw new Error(`Fixture Site ${spec.slug} has invalid Site settings: ${JSON.stringify(parsed.errors)}`);
  }
  return {
    ...parsed.value.settings,
    _id: new ObjectId(),
    slug: parsed.value.slug,
    ownerId,
    createdAt: now,
    updatedAt: now,
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
  const old = await db.collection('sites').find({ slug: { $in: slugs } }, { projection: { _id: 1 } }).toArray();
  await db.collection('subscriptions').deleteMany({ siteId: { $in: old.map((t) => t._id) } });
  await db.collection('sites').deleteMany({ slug: { $in: slugs } });
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
  await db.collection('sites').insertMany(sites.map((spec) => siteDoc(spec, ownerIds[spec.owner], now)));
}

/** Removes one run's Users and Sites, and those of any run older than a day. */
async function cleanup(db, runId) {
  const thisRun = `^${RUN_PREFIX}${runId}-`;
  const anyRun = `^${RUN_PREFIX}`;
  const stale = new Date(Date.now() - DAY_MS);
  const siteFilter = { $or: [{ slug: { $regex: thisRun } }, { slug: { $regex: anyRun }, createdAt: { $lt: stale } }] };
  const userFilter = { $or: [{ email: { $regex: thisRun } }, { email: { $regex: anyRun }, createdAt: { $lt: stale } }] };

  const found = await db.collection('sites').find(siteFilter, { projection: { _id: 1 } }).toArray();
  const subs = await db.collection('subscriptions').deleteMany({ siteId: { $in: found.map((s) => s._id) } });
  const sites = await db.collection('sites').deleteMany(siteFilter);
  const users = await db.collection('users').deleteMany(userFilter);
  return { users: users.deletedCount, sites: sites.deletedCount, subscribers: subs.deletedCount };
}

/** Validates the command line against what the target database allows; returns whether demo data is wanted. */
function checkCommand(command, arg, dbName, policy) {
  const withDemo = command === 'demo' || (command === 'reset' && arg === '--demo');
  if ((command === 'reset' || command === 'cleanup') && !policy.fixtures) {
    throw new Error(`Refusing to write test data to ${dbName}`);
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
  return withDemo;
}

async function run(db, dbName, { command, arg, withDemo }) {
  // The data below is written in the current shape, so the database must
  // reach it first, as the app does on its first request.
  const applied = await applyMigrations(db, MIGRATIONS);
  if (applied.length > 0) {
    console.log(`Applied migrations to ${dbName}: ${applied.join(', ')}`);
  }
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
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const { uri, dbName, policy } = target();
  const withDemo = checkCommand(command, arg, dbName, policy);

  const client = await new MongoClient(uri).connect();
  try {
    await run(client.db(dbName), dbName, { command, arg, withDemo });
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
