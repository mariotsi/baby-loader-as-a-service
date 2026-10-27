import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PREVIEW_POOL } from '../src/lib/dbName.ts';
import { chooseSlot, previewConfig, releaseSql } from './preview-pool.mjs';

const [one, two, three] = PREVIEW_POOL;

test('a branch keeps the database it holds', () => {
  const slots = [
    { ...one, branch: null },
    { ...two, branch: 'feat/x' },
  ];
  assert.deepEqual(chooseSlot(slots, 'feat/x'), { held: slots[1] });
});

test('a new branch gets the free databases in pool order', () => {
  const slots = [
    { ...one, branch: 'feat/a' },
    { ...two, branch: null },
    { ...three, branch: null },
  ];
  assert.deepEqual(chooseSlot(slots, 'feat/x'), { free: [slots[1], slots[2]] });
});

test('a full pool leaves a new branch nothing', () => {
  const slots = [
    { ...one, branch: 'feat/a' },
    { ...two, branch: 'feat/b' },
  ];
  assert.deepEqual(chooseSlot(slots, 'feat/x'), { free: [] });
});

test('releasing drops the app tables and keeps the slot and internal tables', () => {
  const sql = releaseSql(['users', 'd1_migrations', 'preview_slot', '_cf_KV', 'sqlite_sequence', 'we"ird']);
  assert.match(sql, /DROP TABLE IF EXISTS "users";/);
  assert.match(sql, /DROP TABLE IF EXISTS "d1_migrations";/);
  assert.match(sql, /DROP TABLE IF EXISTS "we""ird";/);
  assert.doesNotMatch(sql, /"preview_slot"|_cf_KV|sqlite_sequence/);
  assert.match(sql, /UPDATE preview_slot SET branch = NULL WHERE id = 1;$/);
});

test('the Preview config binds DB to the pool database only', () => {
  const config = JSON.parse(previewConfig(readFileSync('wrangler.jsonc', 'utf8'), two));
  for (const d1 of [config.d1_databases, config.previews.d1_databases]) {
    assert.deepEqual(
      d1.map(({ database_name, database_id }) => ({ database_name, database_id })),
      [{ database_name: two.name, database_id: two.id }]
    );
  }
  assert.equal(config.name, 'loading-baby-staging');
  assert.equal(config.previews.vars.APP_ENV, 'preview');
});
