import { createECDH, randomBytes } from 'node:crypto';
import { expect, test } from 'vitest';
import { ENDPOINT_MAX, isPushEndpoint, isValidSubscription, subscriptionSchema } from './subscription.ts';

function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
}

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

test('a Subscription is what a browser hands over, reduced to its endpoint and keys', () => {
  const keys = browserKeys();
  const input = { endpoint: ENDPOINT, expirationTime: null, keys };
  expect(isValidSubscription(input)).toBe(true);
  expect(subscriptionSchema.parse(input)).toStrictEqual({ endpoint: ENDPOINT, keys });
});

test('a Subscription needs an endpoint and both keys', () => {
  for (const input of [
    undefined,
    'subscription',
    { keys: browserKeys() },
    { endpoint: ENDPOINT },
    { endpoint: ENDPOINT, keys: { p256dh: browserKeys().p256dh } },
  ]) {
    expect(isValidSubscription(input), JSON.stringify(input)).toBe(false);
  }
});

test('a push endpoint is https on a named host, without credentials', () => {
  expect(isPushEndpoint(ENDPOINT)).toBe(true);
  for (const endpoint of [
    '',
    42,
    'http://fcm.googleapis.com/fcm/send/abc',
    'ftp://push.example/abc',
    'https://user:secret@push.example/abc',
    'https://localhost/abc',
    'https://push.localhost/abc',
    'https://127.0.0.1/abc',
    'https://2130706433/abc',
    'https://[::1]/abc',
    'https://169.254.169.254/latest',
    'not a url',
    `https://push.example/${'a'.repeat(ENDPOINT_MAX)}`,
  ]) {
    expect(isPushEndpoint(endpoint), String(endpoint)).toBe(false);
    expect(isValidSubscription({ endpoint, keys: browserKeys() }), String(endpoint)).toBe(false);
  }
});

test('a Subscription’s keys are ones web-push could encrypt for', () => {
  const { p256dh, auth } = browserKeys();
  for (const keys of [
    { p256dh: 'p256dh', auth },
    { p256dh: Buffer.alloc(65, 1).toString('base64url'), auth },
    { p256dh, auth: randomBytes(8).toString('base64url') },
    { p256dh, auth: 42 },
  ]) {
    expect(isValidSubscription({ endpoint: ENDPOINT, keys }), JSON.stringify(keys)).toBe(false);
  }
});
