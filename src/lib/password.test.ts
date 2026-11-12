import { assert, expect, test } from 'vitest';
import {
  hashPassword,
  PASSWORD_GENERATIONS,
  type PasswordGeneration,
  type PasswordHash,
  type PasswordPolicy,
  passwordHashSchema,
  verifyPassword,
} from './password.ts';

const PASSWORD = 'Correct horse 9!';
const WRONG = 'Wrong horse 9!';

function generation(id: number): PasswordGeneration {
  const found = PASSWORD_GENERATIONS.find((g) => g.id === id);
  assert(found, `generation ${id}`);
  return found;
}

/** The registry with generation `id`'s policy replaced. */
function withPolicy(id: number, policy: PasswordPolicy): PasswordGeneration[] {
  return PASSWORD_GENERATIONS.map((g) => (g.id === id ? { ...g, policy } : g));
}

test('exactly one generation is current, and it is generation 2', () => {
  expect(PASSWORD_GENERATIONS.filter((g) => g.policy === 'current').map((g) => g.id)).toStrictEqual([2]);
  expect(generation(1).policy).toBe('rehash');
});

test('a new hash is generation 2: scrypt N=2^14, r=8, p=5, and verifies as valid', async () => {
  const stored = await hashPassword(PASSWORD);
  expect(stored).toMatch(/^v2\$scrypt\$16384\$8\$5\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  expect(await verifyPassword(PASSWORD, stored)).toBe('valid');
  expect(await verifyPassword(WRONG, stored)).toBe('invalid');
});

test('a generation 1 hash, stored without a prefix, verifies with rehash', async () => {
  const stored = await hashPassword(PASSWORD, generation(1));
  expect(stored).toMatch(/^scrypt\$65536\$8\$2\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  expect(await verifyPassword(PASSWORD, stored)).toBe('rehash');
  expect(await verifyPassword(WRONG, stored)).toBe('invalid');
});

test('a generation whose policy is change verifies with change', async () => {
  const generations = withPolicy(1, 'change');
  const stored = await hashPassword(PASSWORD, generation(1));
  expect(await verifyPassword(PASSWORD, stored, generations)).toBe('change');
  expect(await verifyPassword(WRONG, stored, generations)).toBe('invalid');
});

test('a generation whose policy is retired asks for a reset only for the right password', async () => {
  const generations = withPolicy(1, 'retired');
  const stored = await hashPassword(PASSWORD, generation(1));
  expect(await verifyPassword(PASSWORD, stored, generations)).toBe('reset');
  // A wrong password reads like any other, so it reveals nothing about the account.
  expect(await verifyPassword(WRONG, stored, generations)).toBe('invalid');
});

/** What the users table could hold after a bad write or a hand edit: any string at all. */
function anyStoredHash(hash: string): PasswordHash {
  return passwordHashSchema.parse(hash);
}

test('an unknown generation is invalid', async () => {
  const current = await hashPassword(PASSWORD);
  expect(await verifyPassword(PASSWORD, anyStoredHash(current.replace(/^v2\$/, 'v9$')))).toBe('invalid');
  expect(await verifyPassword(PASSWORD, anyStoredHash(current.replace(/^v2\$/, 'v0$')))).toBe('invalid');
});

test('a hash whose fields do not match its generation is invalid', async () => {
  const one = await hashPassword(PASSWORD, generation(1));
  const two = await hashPassword(PASSWORD);
  // Each generation reads only its own cost.
  expect(await verifyPassword(PASSWORD, anyStoredHash(`v2$${one}`))).toBe('invalid');
  expect(await verifyPassword(PASSWORD, anyStoredHash(two.replace(/^v2\$/, '')))).toBe('invalid');
});

test('a malformed hash is invalid', async () => {
  for (const raw of [
    '',
    'v2$',
    'v2$bcrypt$16384$8$5$aa$bb',
    'v2$scrypt$16384$8$5$$bb',
    'v2$scrypt$16384$8$5$aa$',
    'v2$scrypt$16384$8$5$aa$not-hex',
    'salt:hash',
  ]) {
    expect(await verifyPassword(PASSWORD, anyStoredHash(raw)), raw).toBe('invalid');
  }
});
