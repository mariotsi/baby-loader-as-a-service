import { expect, test } from 'vitest';
import { appEnv } from './appEnv.ts';

test('appEnv reads the deployment from APP_ENV', () => {
  expect(appEnv({ APP_ENV: 'production' })).toBe('production');
  expect(appEnv({ APP_ENV: 'staging' })).toBe('staging');
  expect(appEnv({ APP_ENV: 'preview' })).toBe('preview');
});

test('appEnv falls back to development when APP_ENV names no deployment', () => {
  expect(appEnv({})).toBe('development');
  expect(appEnv({ APP_ENV: 'development' })).toBe('development');
  expect(appEnv({ APP_ENV: 'prod' })).toBe('development');
});
