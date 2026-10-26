import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPreviewDbName, PRODUCTION_DB_NAME, previewDbName, STAGING_DB_NAME, testDataPolicy } from './dbName.ts';

test('previewDbName lowercases the branch and replaces separators', () => {
  assert.equal(previewDbName('Feat/Staging_Env'), 'loading-baby-feat-staging-env');
  assert.equal(previewDbName('fix--double..dots'), 'loading-baby-fix-double-dots');
  assert.equal(previewDbName('/leading-and-trailing/'), 'loading-baby-leading-and-trailing');
});

test('previewDbName keeps long names within 38 characters and apart', () => {
  const a = previewDbName(`feature/${'x'.repeat(80)}-a`);
  const b = previewDbName(`feature/${'x'.repeat(80)}-b`);
  assert.ok(a.length <= 38 && b.length <= 38);
  assert.notEqual(a, b);
  assert.match(a, /^loading-baby-feature-x+-[0-9a-f]{8}$/);
});

test('previewDbName rejects a branch with no usable characters', () => {
  assert.throws(() => previewDbName('///'));
});

test('isPreviewDbName rejects the production database and accepts preview names', () => {
  assert.equal(isPreviewDbName(PRODUCTION_DB_NAME), false);
  assert.equal(isPreviewDbName(`${PRODUCTION_DB_NAME}-`), false);
  assert.equal(isPreviewDbName('pushnotify'), false);
  assert.equal(isPreviewDbName(previewDbName('feat/x')), true);
  assert.equal(isPreviewDbName(previewDbName(`feature/${'x'.repeat(80)}`)), true);
});

test('testDataPolicy never writes test data to production', () => {
  assert.deepEqual(testDataPolicy({ local: false, dbName: PRODUCTION_DB_NAME }), { fixtures: false, demo: false });
  assert.deepEqual(testDataPolicy({ local: false, dbName: 'pushnotify' }), { fixtures: false, demo: false });
});

test('testDataPolicy keeps demo data off staging', () => {
  assert.deepEqual(testDataPolicy({ local: false, dbName: STAGING_DB_NAME }), { fixtures: true, demo: false });
  assert.deepEqual(testDataPolicy({ local: false, dbName: previewDbName('feat/x') }), { fixtures: true, demo: true });
});

test('testDataPolicy allows everything on a local database', () => {
  assert.deepEqual(testDataPolicy({ local: true, dbName: STAGING_DB_NAME }), { fixtures: true, demo: true });
});

test('previewDbName fits a branch name that just overflows the limit', () => {
  const name = previewDbName('real-address-in-slug-field');
  assert.ok(name.length <= 38, name);
  assert.match(name, /^loading-baby-real-address-.*-[0-9a-f]{8}$/);
  assert.equal(isPreviewDbName(name), true);
});
