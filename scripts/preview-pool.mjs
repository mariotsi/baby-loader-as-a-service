#!/usr/bin/env node
// Lends the Preview pool's D1 databases (PREVIEW_POOL in src/lib/dbName.ts) to
// branches, one branch per database, as recorded in each database's one-row
// preview_slot table. Run by .github/workflows/cd.yml and drop-preview-db.yml.
//
//   node scripts/preview-pool.mjs claim <branch>             the database the branch holds, or the first free one
//   node scripts/preview-pool.mjs release <branch>           wipes the branch's database and frees it
//   node scripts/preview-pool.mjs config <database> <file>   writes a wrangler config binding DB to that pool database
//
// claim writes database, database_id and preview_name to $GITHUB_OUTPUT when
// it is set, else to stdout. With every database held by another branch it
// fails, with an error annotation and a job summary naming the holders.
// Statements run through `wrangler d1 execute --remote`, so CLOUDFLARE_API_TOKEN
// must be set. Only pool databases are ever read or written.

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { isPreviewDbName, PREVIEW_POOL, previewName } from '../src/lib/dbName.ts';

const SLOT_TABLE = 'preview_slot';
const ENSURE_SLOT = `CREATE TABLE IF NOT EXISTS ${SLOT_TABLE} (id INTEGER PRIMARY KEY CHECK (id = 1), branch TEXT); INSERT OR IGNORE INTO ${SLOT_TABLE} (id, branch) VALUES (1, NULL);`;

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** The results of the last statement of `sql` run on a pool database. */
function query(dbName, sql) {
  if (!isPreviewDbName(dbName)) {
    throw new Error(`${dbName} is not in the Preview pool`);
  }
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', dbName, '--remote', '--json', '--command', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out).at(-1).results;
}

/**
 * Which pool database a branch gets, given who holds each one (null for a
 * free one): the one it already holds, else the free ones in pool order.
 */
export function chooseSlot(slots, branch) {
  const held = slots.find((slot) => slot.branch === branch);
  if (held) {
    return { held };
  }
  return { free: slots.filter((slot) => slot.branch === null) };
}

/** Drops every table but preview_slot, the migrations table included, and frees the slot. */
export function releaseSql(tables) {
  const drops = tables
    .filter((name) => name !== SLOT_TABLE && !name.startsWith('sqlite_') && !name.startsWith('_cf_'))
    .map((name) => `DROP TABLE IF EXISTS "${name.replaceAll('"', '""')}";`);
  return ['PRAGMA defer_foreign_keys = on;', ...drops, `UPDATE ${SLOT_TABLE} SET branch = NULL WHERE id = 1;`].join(
    ' '
  );
}

/**
 * The staging config with DB bound to a pool database, at the top level and
 * in `previews`, so neither the Preview nor its migrations can reach
 * staging's database. The config's comments sit on lines of their own.
 */
export function previewConfig(jsonc, db) {
  const config = JSON.parse(
    jsonc
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
  );
  const binding = (d1) =>
    d1.map((entry) => (entry.binding === 'DB' ? { ...entry, database_name: db.name, database_id: db.id } : entry));
  config.d1_databases = binding(config.d1_databases);
  config.previews.d1_databases = binding(config.previews.d1_databases);
  return `${JSON.stringify(config, null, 2)}\n`;
}

function readSlots() {
  return PREVIEW_POOL.map((db) => ({
    ...db,
    branch: query(db.name, `${ENSURE_SLOT} SELECT branch FROM ${SLOT_TABLE};`)[0].branch,
  }));
}

function exhausted(all) {
  const holders = all.map((slot) => `- \`${slot.name}\`: \`${slot.branch}\``).join('\n');
  const summary = `## Preview pool exhausted\n\nEvery Preview database belongs to another branch, so this branch gets no Preview:\n\n${holders}\n\nClose or merge one of those branches' pull requests to free its database, or grow the pool: create \`loading-baby-preview-${all.length + 1}\` and add it to \`PREVIEW_POOL\` in \`src/lib/dbName.ts\`.\n`;
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  const held = all.map((slot) => `${slot.name} (${slot.branch})`).join(', ');
  console.log(
    `::error title=Preview pool exhausted::Every Preview database belongs to another branch: ${held}. Close or merge one of their pull requests, or grow PREVIEW_POOL in src/lib/dbName.ts.`
  );
  process.exit(1);
}

function claim(branch) {
  const all = readSlots();
  const choice = chooseSlot(all, branch);
  let db = choice.held;
  // Two branches may race for one free database: the conditional update
  // lets only one of them take it, and the other moves on to the next.
  for (const slot of choice.free ?? []) {
    const won = query(
      slot.name,
      `UPDATE ${SLOT_TABLE} SET branch = ${literal(branch)} WHERE id = 1 AND branch IS NULL RETURNING branch;`
    );
    if (won.length > 0) {
      db = slot;
      break;
    }
  }
  if (!db) {
    exhausted(readSlots());
  }
  console.error(`${branch} ${choice.held ? 'keeps' : 'claims'} ${db.name}`);
  const lines = `database=${db.name}\ndatabase_id=${db.id}\npreview_name=${previewName(branch)}\n`;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, lines);
  } else {
    process.stdout.write(lines);
  }
}

function release(branch) {
  const db = readSlots().find((slot) => slot.branch === branch);
  if (!db) {
    console.log(`${branch} holds no Preview database.`);
    return;
  }
  const tables = query(db.name, "SELECT name FROM sqlite_master WHERE type = 'table';").map((row) => row.name);
  query(db.name, releaseSql(tables));
  console.log(`Released ${db.name} from ${branch}.`);
}

function writeConfig(dbName, file) {
  const db = PREVIEW_POOL.find((entry) => entry.name === dbName);
  if (!db) {
    throw new Error(`${dbName} is not in the Preview pool`);
  }
  writeFileSync(file, previewConfig(readFileSync('wrangler.jsonc', 'utf8'), db));
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'claim' && args[0]) {
    claim(args[0]);
  } else if (command === 'release' && args[0]) {
    release(args[0]);
  } else if (command === 'config' && args[0] && args[1]) {
    writeConfig(args[0], args[1]);
  } else {
    throw new Error('Usage: preview-pool.mjs claim <branch> | release <branch> | config <database> <file>');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
