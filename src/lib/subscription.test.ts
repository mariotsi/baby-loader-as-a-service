import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { test } from 'node:test';
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
  assert.equal(isValidSubscription(input), true);
  assert.deepEqual(subscriptionSchema.parse(input), { endpoint: ENDPOINT, keys });
});

test('a Subscription needs an endpoint and both keys', () => {
  for (const input of [
    undefined,
    'subscription',
    { keys: browserKeys() },
    { endpoint: ENDPOINT },
    { endpoint: ENDPOINT, keys: { p256dh: browserKeys().p256dh } },
  ]) {
    assert.equal(isValidSubscription(input), false, JSON.stringify(input));
  }
});

test('a push endpoint is https on a named host, without credentials', () => {
  assert.equal(isPushEndpoint(ENDPOINT), true);
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
    assert.equal(isPushEndpoint(endpoint), false, String(endpoint));
    assert.equal(isValidSubscription({ endpoint, keys: browserKeys() }), false, String(endpoint));
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
    assert.equal(isValidSubscription({ endpoint: ENDPOINT, keys }), false, JSON.stringify(keys));
  }
});
