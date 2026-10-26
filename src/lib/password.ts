import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * OWASP-recommended scrypt profile with the lowest memory cost: each hash
 * needs 128 * N * r bytes (16 MiB). A Workers isolate has 128 MB in total and
 * runs several logins at once, so a higher N risks running it out of memory;
 * p carries the extra work instead, since it adds time but no memory.
 */
const SCRYPT_COST = { N: 2 ** 14, r: 8, p: 5 };
const SCRYPT_KEYLEN = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

function runScrypt(password: string, salt: string, N: number, r: number, p: number): Promise<Buffer> {
  // Node rejects any call needing more than maxmem, which defaults to 32 MiB
  // and counts a little more than 128 * N * r, so it gets twice that.
  return scryptAsync(password, salt, SCRYPT_KEYLEN, { N, r, p, maxmem: 2 * 128 * N * r });
}

function parseHash(stored: string) {
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  const [N, R, P] = [n, r, p].map(Number);
  if (algorithm !== 'scrypt' || !salt || !hash || ![N, R, P].every((v) => Number.isInteger(v) && v > 0)) {
    return null;
  }
  return { N, r: R, p: P, salt, hash };
}

/**
 * Returns `scrypt$N$r$p$salt$hash` (salt and hash in hex). The cost travels
 * with each hash, so raising SCRYPT_COST leaves existing hashes verifiable.
 *
 * Imports only Node built-ins, so scripts run by plain `node` (the E2E data
 * script) hash passwords exactly as the app does.
 */
export async function hashPassword(password: string): Promise<string> {
  const { N, r, p } = SCRYPT_COST;
  const salt = randomBytes(16).toString('hex');
  const hash = await runScrypt(password, salt, N, r, p);
  return ['scrypt', N, r, p, salt, hash.toString('hex')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) {
    return false;
  }
  const candidate = await runScrypt(password, parsed.salt, parsed.N, parsed.r, parsed.p);
  const expected = Buffer.from(parsed.hash, 'hex');
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}

/**
 * True when a stored hash was made with a cost other than SCRYPT_COST, so the
 * login that has just verified it hashes the password again and saves it.
 */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  const { N, r, p } = SCRYPT_COST;
  return !parsed || parsed.N !== N || parsed.r !== r || parsed.p !== p;
}
