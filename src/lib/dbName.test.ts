import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  databaseName,
  isLocalMongoUri,
  isPreviewDbName,
  previewDbName,
  testDataPolicy,
  PRODUCTION_DB_NAME,
  STAGING_DB_NAME,
} from './dbName.ts';

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

test('databaseName falls back to staging off Vercel', () => {
  assert.equal(databaseName({}), STAGING_DB_NAME);
});

test('databaseName refuses a production deployment without MONGODB_DB_NAME', () => {
  assert.throws(() => databaseName({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), /MONGODB_DB_NAME/);
  assert.throws(() => databaseName({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'staging' }), /MONGODB_DB_NAME/);
  assert.equal(databaseName({ VERCEL_ENV: 'production', MONGODB_DB_NAME: PRODUCTION_DB_NAME }), PRODUCTION_DB_NAME);
});

test('isPreviewDbName rejects the production database and accepts preview names', () => {
  assert.equal(isPreviewDbName(PRODUCTION_DB_NAME), false);
  assert.equal(isPreviewDbName(`${PRODUCTION_DB_NAME}-`), false);
  assert.equal(isPreviewDbName('pushnotify'), false);
  assert.equal(isPreviewDbName(previewDbName('feat/x')), true);
  assert.equal(isPreviewDbName(previewDbName(`feature/${'x'.repeat(80)}`)), true);
});

test('isLocalMongoUri accepts only hosts on this machine', () => {
  assert.equal(isLocalMongoUri('mongodb://localhost:27017'), true);
  assert.equal(isLocalMongoUri('mongodb://user:pw@127.0.0.1:27017/?directConnection=true'), true);
  assert.equal(isLocalMongoUri('mongodb://localhost:27017,127.0.0.1:27018'), true);
  assert.equal(isLocalMongoUri('mongodb://localhost:27017,db.example.com:27017'), false);
  assert.equal(isLocalMongoUri('mongodb+srv://user:pw@cluster.example.mongodb.net/'), false);
  assert.equal(isLocalMongoUri('mongodb://localhost.example.com:27017'), false);
});

test('testDataPolicy never writes test data to production', () => {
  const remote = 'mongodb+srv://user:pw@cluster.example.mongodb.net/';
  assert.deepEqual(testDataPolicy(remote, PRODUCTION_DB_NAME), { fixtures: false, demo: false });
  assert.deepEqual(testDataPolicy(remote, 'pushnotify'), { fixtures: false, demo: false });
});

test('testDataPolicy keeps demo data off staging', () => {
  const remote = 'mongodb+srv://user:pw@cluster.example.mongodb.net/';
  assert.deepEqual(testDataPolicy(remote, STAGING_DB_NAME), { fixtures: true, demo: false });
  assert.deepEqual(testDataPolicy(remote, previewDbName('feat/x')), { fixtures: true, demo: true });
});

test('testDataPolicy allows everything on a local server', () => {
  assert.deepEqual(testDataPolicy('mongodb://localhost:27017', STAGING_DB_NAME), { fixtures: true, demo: true });
});
