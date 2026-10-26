import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startTestDb } from '../db/testDb.ts';
import { createUser, getUserByEmail, logIn, updatePasswordHash } from './auth.ts';
import {
  hashPassword,
  PASSWORD_GENERATIONS,
  type PasswordGeneration,
  type PasswordPolicy,
  verifyPassword,
} from './password.ts';

const PASSWORD = 'Correct horse 9!';

let stopDb: () => Promise<void>;
before(async () => {
  stopDb = await startTestDb();
});
after(() => stopDb());

const generationOne = PASSWORD_GENERATIONS.find((g) => g.id === 1) as PasswordGeneration;

/** The registry with generation 1's policy replaced. */
function withGenerationOne(policy: PasswordPolicy): PasswordGeneration[] {
  return PASSWORD_GENERATIONS.map((g) => (g.id === 1 ? { ...g, policy } : g));
}

/** A User whose stored hash is generation 1. */
async function generationOneUser(email: string): Promise<string> {
  const user = await createUser(email, PASSWORD);
  const stored = await hashPassword(PASSWORD, generationOne);
  await updatePasswordHash(user.id, stored);
  return stored;
}

async function storedHash(email: string): Promise<string> {
  const user = await getUserByEmail(email);
  assert.ok(user);
  return user.passwordHash;
}

test('a current hash logs in as it is', async () => {
  await createUser('current@example.test', PASSWORD);
  const stored = await storedHash('current@example.test');
  const result = await logIn('current@example.test', PASSWORD);
  assert.ok(result.ok);
  assert.equal(result.passwordChangePending, false);
  assert.equal(await storedHash('current@example.test'), stored);
});

test('a wrong password or an unknown email is wrongCredentials', async () => {
  await createUser('wrong@example.test', PASSWORD);
  assert.deepEqual(await logIn('wrong@example.test', 'Wrong horse 9!'), { ok: false, code: 'wrongCredentials' });
  assert.deepEqual(await logIn('nobody@example.test', PASSWORD), { ok: false, code: 'wrongCredentials' });
});

test('a generation 1 hash logs in and is replaced with a generation 2 hash', async () => {
  await generationOneUser('rehash@example.test');
  const result = await logIn('rehash@example.test', PASSWORD);
  assert.ok(result.ok);
  assert.equal(result.passwordChangePending, false);
  const upgraded = await storedHash('rehash@example.test');
  assert.match(upgraded, /^v2\$scrypt\$16384\$8\$5\$/);
  assert.equal(await verifyPassword(PASSWORD, upgraded), 'valid');
  assert.ok((await logIn('rehash@example.test', PASSWORD)).ok, 'the upgraded password logs in again');
});

test('a hash whose generation has policy change logs in with a password change pending, hash untouched', async () => {
  const stored = await generationOneUser('change@example.test');
  const result = await logIn('change@example.test', PASSWORD, withGenerationOne('change'));
  assert.ok(result.ok);
  assert.equal(result.passwordChangePending, true);
  assert.equal(await storedHash('change@example.test'), stored);
});

test('the right password for a retired hash is refused with passwordResetRequired, a wrong one with wrongCredentials', async () => {
  const stored = await generationOneUser('retired@example.test');
  const retired = withGenerationOne('retired');
  assert.deepEqual(await logIn('retired@example.test', PASSWORD, retired), {
    ok: false,
    code: 'passwordResetRequired',
  });
  assert.deepEqual(await logIn('retired@example.test', 'Wrong horse 9!', retired), {
    ok: false,
    code: 'wrongCredentials',
  });
  assert.equal(await storedHash('retired@example.test'), stored);
});
