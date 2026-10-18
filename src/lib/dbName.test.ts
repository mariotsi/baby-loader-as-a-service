import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseName, isPreviewDbName, previewDbName, DEFAULT_DB_NAME } from './dbName.ts';

test('previewDbName lowercases the branch and replaces separators', () => {
  assert.equal(previewDbName('Feat/Staging_Env'), 'waitingpages-feat-staging-env');
  assert.equal(previewDbName('fix--double..dots'), 'waitingpages-fix-double-dots');
  assert.equal(previewDbName('/leading-and-trailing/'), 'waitingpages-leading-and-trailing');
});

test('previewDbName keeps long names within 64 characters and apart', () => {
  const a = previewDbName(`feature/${'x'.repeat(80)}-a`);
  const b = previewDbName(`feature/${'x'.repeat(80)}-b`);
  assert.ok(a.length <= 64 && b.length <= 64);
  assert.notEqual(a, b);
  assert.match(a, /^waitingpages-feature-x+-[0-9a-f]{8}$/);
});

test('previewDbName rejects a branch with no usable characters', () => {
  assert.throws(() => previewDbName('///'));
});

test('databaseName prefers MONGODB_DB_NAME', () => {
  const env = { MONGODB_DB_NAME: 'waitingpages-staging', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/x' };
  assert.equal(databaseName(env), 'waitingpages-staging');
});

test('databaseName derives a preview deployment database from its branch', () => {
  assert.equal(databaseName({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/x' }), 'waitingpages-feat-x');
});

test('databaseName falls back to the default in production and locally', () => {
  assert.equal(databaseName({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), DEFAULT_DB_NAME);
  assert.equal(databaseName({}), DEFAULT_DB_NAME);
});

test('isPreviewDbName rejects the production database and accepts preview names', () => {
  assert.equal(isPreviewDbName(DEFAULT_DB_NAME), false);
  assert.equal(isPreviewDbName(`${DEFAULT_DB_NAME}-`), false);
  assert.equal(isPreviewDbName('pushnotify'), false);
  assert.equal(isPreviewDbName(previewDbName('feat/x')), true);
  assert.equal(isPreviewDbName(previewDbName(`feature/${'x'.repeat(80)}`)), true);
});
