#!/usr/bin/env node
// Copies Users, Sites and Subscriptions from a MongoDB database into a D1
// database, once per cutover (ADR-0009).
//
//   node scripts/copy-mongo-to-d1.mjs --source-uri <mongodb uri> --source-db <name> --target <d1 name>
//     [--remote | --persist-to <dir>] [--dry-run]
//
// Every row gets a new UUID; owner_id and site_id point at the new ids of
// the same User and Site, found by their natural keys (email, Slug, Site and
// endpoint). A run inserts what's missing and updates what changed, keeping
// the D1 row's id, so it can run again during a cutover; it never deletes. A
// remote target needs CLOUDFLARE_API_TOKEN.

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import { parseSiteSettings } from '../src/lib/siteSettings.ts';

/** Statements per `wrangler d1 execute`: well inside D1's limits on one request. */
const BATCH = 200;

function sql(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(Number(value));
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function iso(date) {
  return (date instanceof Date ? date : new Date(date)).toISOString();
}

/** The fields a stored Site keeps outside its Site settings. */
const SITE_FIELDS = ['_id', 'slug', 'ownerId', 'createdAt', 'updatedAt', 'customDomain', 'customDomainVerified'];

export function userStatement(user) {
  const values = [randomUUID(), user.email.trim().toLowerCase(), user.passwordHash, iso(user.createdAt)].map(sql);
  return `INSERT INTO users (id, email, password_hash, created_at) VALUES (${values.join(', ')})
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash
  WHERE users.password_hash IS NOT excluded.password_hash
  RETURNING id;`;
}

/** The Site's row, or the reason it can't be copied: its settings must pass the rules that held when it was saved. */
export function siteStatement(site, ownerEmail) {
  if (!ownerEmail) {
    return { skip: 'its Owner is missing' };
  }
  const settings = Object.fromEntries(Object.entries(site).filter(([key]) => !SITE_FIELDS.includes(key)));
  const parsed = parseSiteSettings(settings, new Date(site.updatedAt));
  if (!parsed.ok) {
    return { skip: `invalid Site settings ${JSON.stringify(parsed.errors)}` };
  }
  const owner = `(SELECT id FROM users WHERE email = ${sql(ownerEmail.trim().toLowerCase())})`;
  const values = [
    sql(randomUUID()),
    sql(site.slug),
    owner,
    sql(JSON.stringify(parsed.value)),
    sql(site.customDomain ?? null),
    sql(Boolean(site.customDomainVerified)),
    sql(iso(site.createdAt)),
    sql(iso(site.updatedAt)),
  ];
  return {
    statement: `INSERT INTO sites (id, slug, owner_id, settings, custom_domain, custom_domain_verified, created_at, updated_at) VALUES (${values.join(', ')})
  ON CONFLICT(slug) DO UPDATE SET owner_id = excluded.owner_id, settings = excluded.settings, custom_domain = excluded.custom_domain,
    custom_domain_verified = excluded.custom_domain_verified, updated_at = excluded.updated_at
  WHERE sites.updated_at IS NOT excluded.updated_at OR sites.owner_id IS NOT excluded.owner_id
  RETURNING id;`,
  };
}

export function subscriptionStatement(sub, slug) {
  if (!slug) {
    return { skip: 'its Site is missing' };
  }
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { skip: 'it has no endpoint or keys' };
  }
  const values = [
    sql(randomUUID()),
    `(SELECT id FROM sites WHERE slug = ${sql(slug)})`,
    sql(sub.endpoint),
    sql(sub.keys.p256dh),
    sql(sub.keys.auth),
    sql(sub.lang ?? null),
    sql(sub.deviceInfo ? JSON.stringify(sub.deviceInfo) : null),
    sql(sub.geo ? JSON.stringify(sub.geo) : null),
    sql(iso(sub.createdAt)),
    sql(iso(sub.updatedAt ?? sub.createdAt)),
  ];
  return {
    statement: `INSERT INTO subscriptions (id, site_id, endpoint, p256dh, auth, lang, device_info, geo, created_at, updated_at) VALUES (${values.join(', ')})
  ON CONFLICT(site_id, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang,
    device_info = excluded.device_info, geo = excluded.geo, updated_at = excluded.updated_at
  WHERE subscriptions.updated_at IS NOT excluded.updated_at
  RETURNING id;`,
  };
}

/** Every statement the copy runs, Users first so Sites can find their Owner, and what it skips. */
export async function plan(db) {
  const users = await db.collection('users').find().toArray();
  const sites = await db.collection('sites').find().toArray();
  const subscriptions = await db.collection('subscriptions').find().toArray();
  const emailById = new Map(users.map((u) => [String(u._id), u.email]));
  const slugById = new Map();
  const statements = users.map(userStatement);
  const skipped = [];
  for (const site of sites) {
    const result = siteStatement(site, emailById.get(String(site.ownerId)));
    if ('skip' in result) {
      skipped.push({ collection: 'sites', id: String(site._id), reason: result.skip });
      continue;
    }
    slugById.set(String(site._id), site.slug);
    statements.push(result.statement);
  }
  for (const sub of subscriptions) {
    const result = subscriptionStatement(sub, slugById.get(String(sub.siteId)));
    if ('skip' in result) {
      skipped.push({ collection: 'subscriptions', id: String(sub._id), reason: result.skip });
      continue;
    }
    statements.push(result.statement);
  }
  return {
    statements,
    skipped,
    read: { users: users.length, sites: sites.length, subscriptions: subscriptions.length },
  };
}

/**
 * The JSON `wrangler d1 execute --json` prints. On a remote target Wrangler
 * prints progress lines first ("├ Checking if file needs uploading"), so the
 * JSON starts at the first line that opens an array or object.
 */
export function parseWranglerJson(out) {
  const lines = out.split('\n');
  const start = lines.findIndex((line) => /^\s*[[{]/.test(line));
  if (start === -1) {
    throw new Error(`wrangler printed no JSON: ${out.slice(0, 200)}`);
  }
  return JSON.parse(lines.slice(start).join('\n'));
}

/** Runs the statements in batches and returns how many rows they wrote: each upsert returns a row only when it writes one. */
function execute(target, location, statements) {
  const dir = mkdtempSync(join(tmpdir(), 'copy-to-d1-'));
  let written = 0;
  try {
    for (let i = 0; i < statements.length; i += BATCH) {
      const file = join(dir, `batch-${i}.sql`);
      writeFileSync(file, `${statements.slice(i, i + BATCH).join('\n')}\n`);
      const out = execFileSync(
        'npx',
        ['wrangler', 'd1', 'execute', target, ...location, '--file', file, '--json', '--yes'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
      );
      for (const result of parseWranglerJson(out)) {
        written += result.results?.length ?? 0;
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return written;
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      'source-uri': { type: 'string' },
      'source-db': { type: 'string' },
      target: { type: 'string' },
      remote: { type: 'boolean', default: false },
      'persist-to': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const uri = args['source-uri'] ?? process.env.MONGO_SOURCE_URI;
  if (!uri || !args['source-db'] || !args.target) {
    throw new Error(
      'Usage: --source-uri <uri> --source-db <name> --target <d1 name> [--remote | --persist-to <dir>] [--dry-run]'
    );
  }
  const location = args.remote
    ? ['--remote']
    : ['--local', ...(args['persist-to'] ? ['--persist-to', args['persist-to']] : [])];

  const client = await new MongoClient(uri).connect();
  let result;
  try {
    result = await plan(client.db(args['source-db']));
  } finally {
    await client.close();
  }

  console.log(`Read from ${args['source-db']}:`, result.read);
  for (const skip of result.skipped) {
    console.log(`Skipping ${skip.collection} ${skip.id}: ${skip.reason}`);
  }
  if (args['dry-run']) {
    console.log(`Dry run: ${result.statements.length} rows would be upserted into ${args.target}.`);
    return;
  }
  const written = execute(args.target, location, result.statements);
  console.log(
    `Wrote ${written} rows to ${args.target} (${args.remote ? 'remote' : 'local'}), skipped ${result.skipped.length}.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
