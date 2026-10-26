import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hashPassword,
  PASSWORD_GENERATIONS,
  type PasswordGeneration,
  type PasswordPolicy,
  verifyPassword,
} from './password.ts';

const PASSWORD = 'Correct horse 9!';
const WRONG = 'Wrong horse 9!';

function generation(id: number): PasswordGeneration {
  const found = PASSWORD_GENERATIONS.find((g) => g.id === id);
  assert.ok(found, `generation ${id}`);
  return found;
}

/** The registry with generation `id`'s policy replaced. */
function withPolicy(id: number, policy: PasswordPolicy): PasswordGeneration[] {
  return PASSWORD_GENERATIONS.map((g) => (g.id === id ? { ...g, policy } : g));
}

test('exactly one generation is current, and it is generation 2', () => {
  assert.deepEqual(
    PASSWORD_GENERATIONS.filter((g) => g.policy === 'current').map((g) => g.id),
    [2]
  );
  assert.equal(generation(1).policy, 'rehash');
});

test('a new hash is generation 2: scrypt N=2^14, r=8, p=5, and verifies as valid', async () => {
  const stored = await hashPassword(PASSWORD);
  assert.match(stored, /^v2\$scrypt\$16384\$8\$5\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword(PASSWORD, stored), 'valid');
  assert.equal(await verifyPassword(WRONG, stored), 'invalid');
});

test('a generation 1 hash, stored without a prefix, verifies with rehash', async () => {
  const stored = await hashPassword(PASSWORD, generation(1));
  assert.match(stored, /^scrypt\$65536\$8\$2\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword(PASSWORD, stored), 'rehash');
  assert.equal(await verifyPassword(WRONG, stored), 'invalid');
});

test('a generation whose policy is change verifies with change', async () => {
  const generations = withPolicy(1, 'change');
  const stored = await hashPassword(PASSWORD, generation(1));
  assert.equal(await verifyPassword(PASSWORD, stored, generations), 'change');
  assert.equal(await verifyPassword(WRONG, stored, generations), 'invalid');
});

test('a generation whose policy is retired asks for a reset only for the right password', async () => {
  const generations = withPolicy(1, 'retired');
  const stored = await hashPassword(PASSWORD, generation(1));
  assert.equal(await verifyPassword(PASSWORD, stored, generations), 'reset');
  // A wrong password reads like any other, so it reveals nothing about the account.
  assert.equal(await verifyPassword(WRONG, stored, generations), 'invalid');
});

test('an unknown generation is invalid', async () => {
  const current = await hashPassword(PASSWORD);
  assert.equal(await verifyPassword(PASSWORD, current.replace(/^v2\$/, 'v9$')), 'invalid');
  assert.equal(await verifyPassword(PASSWORD, current.replace(/^v2\$/, 'v0$')), 'invalid');
});

test('a hash whose fields do not match its generation is invalid', async () => {
  const one = await hashPassword(PASSWORD, generation(1));
  const two = await hashPassword(PASSWORD);
  // Each generation reads only its own cost.
  assert.equal(await verifyPassword(PASSWORD, `v2$${one}`), 'invalid');
  assert.equal(await verifyPassword(PASSWORD, two.replace(/^v2\$/, '')), 'invalid');
});

test('a malformed hash is invalid', async () => {
  for (const stored of [
    '',
    'v2$',
    'v2$bcrypt$16384$8$5$aa$bb',
    'v2$scrypt$16384$8$5$$bb',
    'v2$scrypt$16384$8$5$aa$',
    'v2$scrypt$16384$8$5$aa$not-hex',
    'salt:hash',
  ]) {
    assert.equal(await verifyPassword(PASSWORD, stored), 'invalid', stored);
  }
});
