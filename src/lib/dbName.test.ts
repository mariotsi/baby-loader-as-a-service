import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isPreviewDbName,
  PREVIEW_POOL,
  PRODUCTION_DB_NAME,
  previewName,
  STAGING_DB_NAME,
  testDataPolicy,
} from './dbName.ts';

const POOL_DB = PREVIEW_POOL[0].name;

test('previewName lowercases the branch and replaces separators', () => {
  assert.equal(previewName('Feat/Staging_Env'), 'feat-staging-env');
  assert.equal(previewName('fix--double..dots'), 'fix-double-dots');
  assert.equal(previewName('/leading-and-trailing/'), 'leading-and-trailing');
});

test('previewName starts with a letter', () => {
  assert.equal(previewName('63-cloudflare'), 'b-63-cloudflare');
});

test('previewName keeps its workers.dev label within 63 characters and apart', () => {
  const a = previewName(`feature/${'x'.repeat(80)}-a`);
  const b = previewName(`feature/${'x'.repeat(80)}-b`);
  assert.ok(`${a}-loading-baby-staging`.length <= 63, a);
  assert.notEqual(a, b);
  assert.match(a, /^feature-x+-[0-9a-f]{8}$/);
});

test('previewName rejects a branch with no usable characters', () => {
  assert.throws(() => previewName('///'));
});

test('isPreviewDbName accepts only the pool', () => {
  assert.equal(isPreviewDbName(PRODUCTION_DB_NAME), false);
  assert.equal(isPreviewDbName(STAGING_DB_NAME), false);
  assert.equal(isPreviewDbName(`${PRODUCTION_DB_NAME}-feat-x`), false);
  for (const db of PREVIEW_POOL) {
    assert.equal(isPreviewDbName(db.name), true);
  }
});

test('the pool never holds production or staging', () => {
  const names = PREVIEW_POOL.map((db) => db.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(!names.includes(PRODUCTION_DB_NAME) && !names.includes(STAGING_DB_NAME));
});

test('testDataPolicy never writes test data to production', () => {
  assert.deepEqual(testDataPolicy({ local: false, dbName: PRODUCTION_DB_NAME }), { fixtures: false, demo: false });
  assert.deepEqual(testDataPolicy({ local: false, dbName: 'pushnotify' }), { fixtures: false, demo: false });
});

test('testDataPolicy keeps demo data off staging', () => {
  assert.deepEqual(testDataPolicy({ local: false, dbName: STAGING_DB_NAME }), { fixtures: true, demo: false });
  assert.deepEqual(testDataPolicy({ local: false, dbName: POOL_DB }), { fixtures: true, demo: true });
});

test('testDataPolicy allows everything on a local database', () => {
  assert.deepEqual(testDataPolicy({ local: true, dbName: STAGING_DB_NAME }), { fixtures: true, demo: true });
});
