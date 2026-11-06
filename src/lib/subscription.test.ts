import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { ENDPOINT_MAX, parseSubscription } from './subscription.ts';

function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
}

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

test('parseSubscription accepts what a browser hands over and keeps only the endpoint and keys', () => {
  const keys = browserKeys();
  const parsed = parseSubscription({ endpoint: ENDPOINT, expirationTime: null, keys });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  assert.deepEqual({ ...parsed.value }, { endpoint: ENDPOINT, keys });
});

test('parseSubscription needs a subscription with an endpoint and both keys', () => {
  assert.deepEqual(parseSubscription(undefined), { ok: false, errors: [{ path: 'subscription', code: 'required' }] });
  assert.deepEqual(parseSubscription({ keys: browserKeys() }), {
    ok: false,
    errors: [{ path: 'subscription.endpoint', code: 'required' }],
  });
  assert.deepEqual(parseSubscription({ endpoint: ENDPOINT, keys: { p256dh: browserKeys().p256dh } }), {
    ok: false,
    errors: [{ path: 'subscription.keys', code: 'required' }],
  });
});

test('parseSubscription takes only an https endpoint on a named host, without credentials', () => {
  const keys = browserKeys();
  for (const endpoint of [
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
  ]) {
    assert.deepEqual(
      parseSubscription({ endpoint, keys }),
      { ok: false, errors: [{ path: 'subscription.endpoint', code: 'invalidFormat' }] },
      endpoint
    );
  }
});

test('parseSubscription refuses an endpoint longer than any push service hands out', () => {
  const endpoint = `https://push.example/${'a'.repeat(ENDPOINT_MAX)}`;
  assert.deepEqual(parseSubscription({ endpoint, keys: browserKeys() }), {
    ok: false,
    errors: [{ path: 'subscription.endpoint', code: 'tooLong', params: { max: ENDPOINT_MAX } }],
  });
});

test('parseSubscription refuses keys web-push could not encrypt for', () => {
  const { p256dh, auth } = browserKeys();
  for (const keys of [
    { p256dh: 'p256dh', auth },
    { p256dh: Buffer.alloc(65, 1).toString('base64url'), auth },
    { p256dh, auth: randomBytes(8).toString('base64url') },
    { p256dh, auth: 42 },
  ]) {
    const parsed = parseSubscription({ endpoint: ENDPOINT, keys });
    assert.equal(parsed.ok, false, JSON.stringify(keys));
  }
});
