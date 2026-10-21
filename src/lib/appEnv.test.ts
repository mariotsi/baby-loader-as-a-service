import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appEnv } from './appEnv.ts';

test('appEnv recognizes a production deployment of main', () => {
  assert.equal(appEnv({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main' }), 'production');
});

test('appEnv recognizes staging as a production deployment of the staging branch', () => {
  assert.equal(appEnv({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'staging' }), 'staging');
});

test('appEnv recognizes any Vercel preview deployment, staging branch included', () => {
  assert.equal(appEnv({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feat/x' }), 'preview');
  assert.equal(appEnv({ VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' }), 'preview');
});

test('appEnv falls back to development off Vercel', () => {
  assert.equal(appEnv({}), 'development');
  assert.equal(appEnv({ VERCEL_ENV: 'development' }), 'development');
});
