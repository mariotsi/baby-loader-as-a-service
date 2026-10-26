#!/usr/bin/env node
// Writes and removes E2E test data. Run by the E2E suite's global setup and
// teardown, and by `npm run seed` for local demo data.
//
//   node scripts/e2e-data.mjs reset [--demo]   E2E fixtures back to their initial state (+ demo data)
//   node scripts/e2e-data.mjs demo             demo data only
//   node scripts/e2e-data.mjs cleanup <runId>  one run's Users and Sites, plus any run's older than a day
//
// Target: the D1 database E2E_D1_DATABASE names (staging's by default),
// remote when E2E_D1_REMOTE is set, else the local one in E2E_D1_PERSIST_TO
// (Wrangler's default state directory, which `npm run dev` uses, when unset).
// testDataPolicy (src/lib/dbName.ts) decides what may be written there:
// nothing on production, fixtures only on staging. The statements run
// through `wrangler d1 execute`, so a remote target needs CLOUDFLARE_API_TOKEN
// and CLOUDFLARE_ACCOUNT_ID.

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_OWNERS, DEMO_SITES, FIXTURE_OWNERS, FIXTURE_SITES, RUN_PREFIX } from '../e2e/support/data.ts';
import { STAGING_DB_NAME, testDataPolicy } from '../src/lib/dbName.ts';
import { hashPassword } from '../src/lib/password.ts';
import { parseNewSite } from '../src/lib/siteSettings.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function dataTarget() {
  const dbName = process.env.E2E_D1_DATABASE || STAGING_DB_NAME;
  const local = !process.env.E2E_D1_REMOTE;
  return { dbName, local, persistTo: process.env.E2E_D1_PERSIST_TO, policy: testDataPolicy({ local, dbName }) };
}

function isoDate(daysFromNow, now) {
  return new Date(now.getTime() + daysFromNow * DAY_MS).toISOString().slice(0, 10);
}

/** A SQL literal: NULL, a number, or a single-quoted string. */
function sql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function list(values) {
  return values.map(sql).join(', ');
}

/**
 * A Site row as createSite (src/lib/site.ts) stores it, its Site settings
 * validated by the same parseNewSite the app runs, so a fixture can never
 * hold settings the app would refuse.
 */
function siteRow(spec, ownerId, now) {
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
        milestones: (spec.milestones ?? []).map((m) => ({
          emoji: m.emoji,
          label: m.label,
          date: isoDate(m.inDays, now),
          ...(m.place ? { place: m.place } : {}),
        })),
        languages: [...spec.languages],
        timezone: 'Europe/Rome',
        theme: { palette: 'blush', font: 'inter' },
        privacy: { showName: spec.showName, showSex: spec.showSex },
        pageName: spec.pageName ?? {},
      },
    },
    now
  );
  if (!parsed.ok) {
    throw new Error(`Fixture Site ${spec.slug} has invalid Site settings: ${JSON.stringify(parsed.errors)}`);
  }
  const at = now.toISOString();
  return `INSERT INTO sites (id, slug, owner_id, settings, custom_domain, custom_domain_verified, created_at, updated_at) VALUES (${list(
    [randomUUID(), parsed.value.slug, ownerId, JSON.stringify(parsed.value.settings), null, 0, at, at]
  )});`;
}

/**
 * Deletes the given Owners and Sites, with the Subscriptions of those Sites,
 * then inserts them afresh, so every run starts from the same state.
 */
async function resetStatements(owners, sites, password) {
  const emails = list(Object.values(owners));
  const slugs = list(sites.map((s) => s.slug));
  const statements = [
    `DELETE FROM subscriptions WHERE site_id IN (SELECT id FROM sites WHERE slug IN (${slugs}) OR owner_id IN (SELECT id FROM users WHERE email IN (${emails})));`,
    `DELETE FROM sites WHERE slug IN (${slugs}) OR owner_id IN (SELECT id FROM users WHERE email IN (${emails}));`,
    `DELETE FROM users WHERE email IN (${emails});`,
  ];
  const now = new Date();
  const passwordHash = await hashPassword(password);
  const ownerIds = {};
  for (const [key, email] of Object.entries(owners)) {
    ownerIds[key] = randomUUID();
    statements.push(
      `INSERT INTO users (id, email, password_hash, created_at) VALUES (${list([ownerIds[key], email, passwordHash, now.toISOString()])});`
    );
  }
  for (const spec of sites) {
    statements.push(siteRow(spec, ownerIds[spec.owner], now));
  }
  return statements;
}

/** Removes one run's Users and Sites, and those of any run older than a day. */
function cleanupStatements(runId) {
  const thisRun = `${RUN_PREFIX}${runId}-%`;
  const anyRun = `${RUN_PREFIX}%`;
  const stale = new Date(Date.now() - DAY_MS).toISOString();
  const runSites = `(slug LIKE ${sql(thisRun)} OR (slug LIKE ${sql(anyRun)} AND created_at < ${sql(stale)}))`;
  const runUsers = `(email LIKE ${sql(thisRun)} OR (email LIKE ${sql(anyRun)} AND created_at < ${sql(stale)}))`;
  return [
    `DELETE FROM subscriptions WHERE site_id IN (SELECT id FROM sites WHERE ${runSites} OR owner_id IN (SELECT id FROM users WHERE ${runUsers}));`,
    `DELETE FROM sites WHERE ${runSites} OR owner_id IN (SELECT id FROM users WHERE ${runUsers});`,
    `DELETE FROM users WHERE ${runUsers};`,
  ];
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

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
}

function locationArgs({ local, persistTo }) {
  if (!local) {
    return ['--remote'];
  }
  return persistTo ? ['--local', '--persist-to', persistTo] : ['--local'];
}

/** Runs the statements on the target in one file, which D1 applies as one batch. */
function execute(target, statements) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-data-'));
  try {
    const file = join(dir, 'data.sql');
    writeFileSync(file, `${statements.join('\n')}\n`);
    wrangler(['d1', 'execute', target.dbName, ...locationArgs(target), '--file', file, '--yes']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  const t = dataTarget();
  const withDemo = checkCommand(command, arg, t.dbName, t.policy);

  // The rows below are written in the current shape, so a local database
  // reaches it first; a remote one is migrated by its deploy.
  if (t.local) {
    wrangler(['d1', 'migrations', 'apply', t.dbName, ...locationArgs(t)]);
  }
  const statements = [];
  if (command === 'reset') {
    statements.push(...(await resetStatements(FIXTURE_OWNERS, FIXTURE_SITES, e2ePassword())));
  }
  if (withDemo) {
    statements.push(
      ...(await resetStatements(DEMO_OWNERS, DEMO_SITES, process.env.DEMO_PASSWORD || 'waiting-pages-demo'))
    );
  }
  if (command === 'cleanup') {
    statements.push(...cleanupStatements(arg));
  }
  execute(t, statements);
  const where = `${t.dbName} (${t.local ? 'local' : 'remote'})`;
  if (command === 'reset') {
    console.log(`E2E fixtures reset in ${where}: ${FIXTURE_SITES.length} Sites.`);
  }
  if (withDemo) {
    console.log(`Demo data reset in ${where}: ${DEMO_SITES.length} Sites.`);
  }
  if (command === 'cleanup') {
    console.log(`Run ${arg} cleaned up in ${where}.`);
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
