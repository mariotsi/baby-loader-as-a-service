import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { PREVIEW_POOL } from '../src/lib/dbName.ts';
import { chooseSlot, previewConfig, releaseSql } from './preview-pool.mjs';

const [one, two, three] = PREVIEW_POOL;

test('a branch keeps the database it holds', () => {
  const slots = [
    { ...one, branch: null },
    { ...two, branch: 'feat/x' },
  ];
  expect(chooseSlot(slots, 'feat/x')).toStrictEqual({ held: slots[1] });
});

test('a new branch gets the free databases in pool order', () => {
  const slots = [
    { ...one, branch: 'feat/a' },
    { ...two, branch: null },
    { ...three, branch: null },
  ];
  expect(chooseSlot(slots, 'feat/x')).toStrictEqual({ free: [slots[1], slots[2]] });
});

test('a full pool leaves a new branch nothing', () => {
  const slots = [
    { ...one, branch: 'feat/a' },
    { ...two, branch: 'feat/b' },
  ];
  expect(chooseSlot(slots, 'feat/x')).toStrictEqual({ free: [] });
});

test('releasing drops the app tables and keeps the slot and internal tables', () => {
  const sql = releaseSql(['users', 'd1_migrations', 'preview_slot', '_cf_KV', 'sqlite_sequence', 'we"ird']);
  expect(sql).toMatch(/DROP TABLE IF EXISTS "users";/);
  expect(sql).toMatch(/DROP TABLE IF EXISTS "d1_migrations";/);
  expect(sql).toMatch(/DROP TABLE IF EXISTS "we""ird";/);
  expect(sql).not.toMatch(/"preview_slot"|_cf_KV|sqlite_sequence/);
  expect(sql).toMatch(/UPDATE preview_slot SET branch = NULL WHERE id = 1;$/);
});

test('the Preview config binds DB to the pool database only', () => {
  const config = JSON.parse(previewConfig(readFileSync('wrangler.jsonc', 'utf8'), two));
  for (const d1 of [config.d1_databases, config.previews.d1_databases]) {
    expect(d1.map(({ database_name, database_id }) => ({ database_name, database_id }))).toStrictEqual([
      { database_name: two.name, database_id: two.id },
    ]);
  }
  expect(config.name).toBe('loading-baby-staging');
  expect(config.previews.vars.APP_ENV).toBe('preview');
});
