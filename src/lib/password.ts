import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing in scheme generations. Every stored hash records the
 * generation that produced it, as `v<generation>$<scheme fields>`, and each
 * generation's policy decides what a login does with a hash of that
 * generation. A hash with no `v` prefix is generation 1.
 *
 * Imports only Node built-ins, so scripts run by plain `node` (the E2E data
 * script) hash passwords exactly as the app does.
 */

/**
 * - `current`: new hashes use it. Exactly one generation is current.
 * - `rehash`: still safe. A login rehashes the password with the current generation, unnoticed.
 * - `change`: verifiable but no longer trusted. After a login the Owner must choose a new password.
 * - `retired`: a right password no longer proves who types it, for example once hashes leaked and the
 *   scheme is weak enough to crack. A login is refused, and the password has to be reset. The scheme
 *   still verifies, so only someone who types the right password learns that the account exists.
 */
export type PasswordPolicy = 'current' | 'rehash' | 'change' | 'retired';

/** How one generation turns a password into its scheme fields, and checks a password against them. */
export interface PasswordScheme {
  hash(password: string): Promise<string>;
  /** Compares in constant time; false for fields the scheme cannot read. */
  verify(password: string, fields: string): Promise<boolean>;
}

export interface PasswordGeneration {
  id: number;
  scheme: PasswordScheme;
  policy: PasswordPolicy;
}

/**
 * What a login does after `verifyPassword`: `valid`, `rehash` and `change`
 * mean the password is right, `rehash` and `change` adding the step their
 * policy asks for. `invalid` is a wrong password or a hash no generation
 * reads; `reset` is the right password for a hash of a retired generation.
 */
export type PasswordCheck = 'valid' | 'rehash' | 'change' | 'invalid' | 'reset';

const SCRYPT_KEYLEN = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

/**
 * scrypt at a fixed cost, as `scrypt$N$r$p$salt$hash` (salt and hash in hex).
 * Each hash needs 128 * N * r bytes; Node rejects a call needing more than
 * `maxmem`, which counts a little more than that, so it gets twice that.
 */
function scryptScheme(N: number, r: number, p: number): PasswordScheme {
  const run = (password: string, salt: string) =>
    scryptAsync(password, salt, SCRYPT_KEYLEN, { N, r, p, maxmem: 2 * 128 * N * r });
  return {
    async hash(password) {
      const salt = randomBytes(16).toString('hex');
      const hash = await run(password, salt);
      return ['scrypt', N, r, p, salt, hash.toString('hex')].join('$');
    },
    async verify(password, fields) {
      const [algorithm, n, rr, pp, salt, hash] = fields.split('$');
      const sameCost = [n, rr, pp].join('$') === [N, r, p].join('$');
      if (algorithm !== 'scrypt' || !sameCost || !salt || !/^[0-9a-f]+$/.test(hash ?? '')) {
        return false;
      }
      const candidate = await run(password, salt);
      const expected = Buffer.from(hash, 'hex');
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    },
  };
}

/**
 * Every generation a stored hash can carry, oldest first. A new scheme is a
 * new entry with policy `current`, and the previous current generation's
 * policy becomes `rehash`, `change` or `retired`.
 */
export const PASSWORD_GENERATIONS: readonly PasswordGeneration[] = [
  // OWASP's 64 MiB scrypt profile: too much memory for a Workers isolate, which has 128 MB in total.
  { id: 1, scheme: scryptScheme(2 ** 16, 8, 2), policy: 'rehash' },
  // OWASP's equivalent 16 MiB profile: p carries the extra work, since it adds time but no memory.
  { id: 2, scheme: scryptScheme(2 ** 14, 8, 5), policy: 'current' },
];

function currentGeneration(generations: readonly PasswordGeneration[]): PasswordGeneration {
  const current = generations.filter((g) => g.policy === 'current');
  if (current.length !== 1) {
    throw new Error(`Exactly one password generation must be current, found ${current.length}`);
  }
  return current[0];
}

/** Hashes with the given generation, by default the current one. */
export async function hashPassword(
  password: string,
  generation: PasswordGeneration = currentGeneration(PASSWORD_GENERATIONS)
): Promise<string> {
  const fields = await generation.scheme.hash(password);
  // Generation 1 predates the prefix, so its hashes are stored without one.
  return generation.id === 1 ? fields : `v${generation.id}$${fields}`;
}

/** The generation id a stored hash names, and its scheme fields. */
function splitHash(stored: string): { id: number; fields: string } {
  const prefix = /^v([1-9][0-9]*)\$/.exec(stored);
  if (!prefix) {
    return { id: 1, fields: stored };
  }
  return { id: Number(prefix[1]), fields: stored.slice(prefix[0].length) };
}

export async function verifyPassword(
  password: string,
  stored: string,
  generations: readonly PasswordGeneration[] = PASSWORD_GENERATIONS
): Promise<PasswordCheck> {
  const split = splitHash(stored);
  const generation = generations.find((g) => g.id === split.id);
  if (!generation) {
    return 'invalid';
  }
  if (!(await generation.scheme.verify(password, split.fields))) {
    return 'invalid';
  }
  if (generation.policy === 'retired') {
    return 'reset';
  }
  return generation.policy === 'current' ? 'valid' : generation.policy;
}
