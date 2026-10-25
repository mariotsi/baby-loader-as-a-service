import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EnvError, validateEnv } from './env.ts';

const VALID = {
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB_NAME: 'waitingpages-dev',
  SESSION_SECRET: 'a-secret',
  VAPID_EMAIL: 'mailto:you@example.com',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: `B${'A'.repeat(86)}`,
  VAPID_PRIVATE_KEY: 'A'.repeat(43),
  ROOT_DOMAIN: 'localhost:3000',
};

function problems(env: Record<string, string | undefined>): string[] {
  try {
    validateEnv(env);
  } catch (err) {
    assert.ok(err instanceof EnvError);
    return err.message.split('\n').slice(1);
  }
  return [];
}

test('validateEnv accepts a complete environment', () => {
  assert.deepEqual(problems(VALID), []);
  assert.equal(validateEnv(VALID).SESSION_SECRET, 'a-secret');
});

test('validateEnv names every missing variable, an empty one included', () => {
  assert.deepEqual(problems({ ...VALID, SESSION_SECRET: undefined, MONGODB_URI: '' }), [
    '- MONGODB_URI is not set',
    '- SESSION_SECRET is not set',
  ]);
});

test('validateEnv names malformed variables', () => {
  assert.deepEqual(
    problems({
      ...VALID,
      MONGODB_URI: 'localhost:27017',
      ROOT_DOMAIN: 'https://loading.baby',
      VAPID_EMAIL: 'you@example.com',
      VERCEL_ENV: 'prod',
    }),
    [
      '- MONGODB_URI must be a mongodb:// or mongodb+srv:// connection string',
      '- VAPID_EMAIL must be a mailto: or https: URL',
      '- ROOT_DOMAIN must be a host, with a port only for localhost',
      '- VERCEL_ENV must be production, preview or development',
    ]
  );
});

test('validateEnv takes no VAPID keypair, but not half of one', () => {
  const { VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ...withoutVapid } = VALID;
  assert.deepEqual(problems(withoutVapid), []);
  assert.deepEqual(problems({ ...withoutVapid, VAPID_EMAIL }), [
    '- NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set, while the rest of the VAPID keypair is',
    '- VAPID_PRIVATE_KEY is not set, while the rest of the VAPID keypair is',
  ]);
});

test('validateEnv requires MONGODB_DB_NAME on production', () => {
  assert.deepEqual(problems({ ...VALID, MONGODB_DB_NAME: undefined, VERCEL_ENV: 'production' }), [
    '- MONGODB_DB_NAME must be set on production deployments',
  ]);
});

test('validateEnv names the problems across variables along with the rest', () => {
  assert.deepEqual(problems({ ...VALID, SESSION_SECRET: undefined, VAPID_PRIVATE_KEY: undefined }), [
    '- SESSION_SECRET is not set',
    '- VAPID_PRIVATE_KEY is not set, while the rest of the VAPID keypair is',
  ]);
});
