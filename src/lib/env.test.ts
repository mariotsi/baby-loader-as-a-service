import { assert, expect, test } from 'vitest';
import { EnvError, validateEnv } from './env.ts';

const VALID = {
  SESSION_SECRET: 'a-secret',
  VAPID_EMAIL: 'mailto:you@example.com',
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: `B${'A'.repeat(86)}`,
  VAPID_PRIVATE_KEY: 'A'.repeat(43),
  ROOT_DOMAIN: 'localhost:3000',
  MEDIA_PUBLIC_URL: 'https://media.loading.baby',
  MEDIA_CACHE_PURGE_TOKEN: 'cache-purge-token',
  MEDIA_CACHE_PURGE_ZONE_ID: '0123456789abcdef0123456789abcdef',
};

function problems(env: Record<string, string | undefined>): string[] {
  try {
    validateEnv(env);
  } catch (err) {
    assert(err instanceof EnvError);
    return err.message.split('\n').slice(1);
  }
  return [];
}

test('validateEnv accepts a complete environment', () => {
  expect(problems(VALID)).toStrictEqual([]);
  expect(validateEnv(VALID).SESSION_SECRET).toBe('a-secret');
});

test('validateEnv names every missing variable, an empty one included', () => {
  expect(problems({ ...VALID, SESSION_SECRET: undefined, VAPID_EMAIL: '' })).toStrictEqual([
    '- SESSION_SECRET is not set',
    '- VAPID_EMAIL is not set, while the rest of the VAPID keypair is',
  ]);
});

test('validateEnv names malformed variables', () => {
  expect(
    problems({
      ...VALID,
      ROOT_DOMAIN: 'https://loading.baby',
      VAPID_EMAIL: 'you@example.com',
      APP_ENV: 'prod',
    })
  ).toStrictEqual([
    '- VAPID_EMAIL must be a mailto: or https: URL',
    '- ROOT_DOMAIN must be a host, with a port only for localhost',
    '- APP_ENV must be production, staging, preview or development',
  ]);
});

test('validateEnv takes no VAPID keypair, but not half of one', () => {
  const { VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, ...withoutVapid } = VALID;
  expect(problems(withoutVapid)).toStrictEqual([]);
  expect(problems({ ...withoutVapid, VAPID_EMAIL })).toStrictEqual([
    '- NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set, while the rest of the VAPID keypair is',
    '- VAPID_PRIVATE_KEY is not set, while the rest of the VAPID keypair is',
  ]);
});

test('validateEnv names the problems across variables along with the rest', () => {
  expect(problems({ ...VALID, SESSION_SECRET: undefined, VAPID_PRIVATE_KEY: undefined })).toStrictEqual([
    '- SESSION_SECRET is not set',
    '- VAPID_PRIVATE_KEY is not set, while the rest of the VAPID keypair is',
  ]);
});

test('a deployment needs both cache purge variables, development neither', () => {
  const { MEDIA_CACHE_PURGE_TOKEN: _token, MEDIA_CACHE_PURGE_ZONE_ID: _zone, ...local } = VALID;
  expect(problems(local)).toStrictEqual([]);
  expect(
    problems({ ...local, APP_ENV: 'preview', MEDIA_CACHE_PURGE_ZONE_ID: VALID.MEDIA_CACHE_PURGE_ZONE_ID })
  ).toStrictEqual(['- MEDIA_CACHE_PURGE_TOKEN is not set, while APP_ENV is a deployment']);
  expect(problems({ ...VALID, APP_ENV: 'production' })).toStrictEqual([]);
});
