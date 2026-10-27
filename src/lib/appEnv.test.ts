import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appEnv } from './appEnv.ts';

test('appEnv reads the deployment from APP_ENV', () => {
  assert.equal(appEnv({ APP_ENV: 'production' }), 'production');
  assert.equal(appEnv({ APP_ENV: 'staging' }), 'staging');
  assert.equal(appEnv({ APP_ENV: 'preview' }), 'preview');
});

test('appEnv falls back to development when APP_ENV names no deployment', () => {
  assert.equal(appEnv({}), 'development');
  assert.equal(appEnv({ APP_ENV: 'development' }), 'development');
  assert.equal(appEnv({ APP_ENV: 'prod' }), 'development');
});
