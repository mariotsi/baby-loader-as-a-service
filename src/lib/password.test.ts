import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { test } from 'node:test';
import { hashPassword, needsRehash, verifyPassword } from './password.ts';

const PASSWORD = 'Correct horse 9!';

/** A hash in the format hashPassword writes, made with an older cost. */
function hashWithCost(password: string, N: number, r: number, p: number): string {
  const salt = '00112233445566778899aabbccddeeff';
  const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 2 * 128 * N * r });
  return ['scrypt', N, r, p, salt, hash.toString('hex')].join('$');
}

test('new hashes use the 16 MiB profile', async () => {
  const stored = await hashPassword(PASSWORD);
  assert.match(stored, /^scrypt\$16384\$8\$5\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
  assert.equal(await verifyPassword('Wrong horse 9!', stored), false);
  assert.equal(needsRehash(stored), false);
});

test('a hash made with the 64 MiB profile still verifies and needs a rehash', async () => {
  const stored = hashWithCost(PASSWORD, 2 ** 16, 8, 2);
  assert.equal(await verifyPassword(PASSWORD, stored), true);
  assert.equal(await verifyPassword('Wrong horse 9!', stored), false);
  assert.equal(needsRehash(stored), true);
});

test('the rehashed password keeps verifying and needs no further rehash', async () => {
  const old = hashWithCost(PASSWORD, 2 ** 16, 8, 2);
  assert.equal(await verifyPassword(PASSWORD, old), true);
  const upgraded = await hashPassword(PASSWORD);
  assert.equal(await verifyPassword(PASSWORD, upgraded), true);
  assert.equal(needsRehash(upgraded), false);
});

test('a malformed hash never verifies and needs a rehash', async () => {
  for (const stored of ['', 'bcrypt$16384$8$5$aa$bb', 'scrypt$0$8$5$aa$bb', 'scrypt$16384$8$5$$bb']) {
    assert.equal(await verifyPassword(PASSWORD, stored), false, stored);
    assert.equal(needsRehash(stored), true, stored);
  }
});
