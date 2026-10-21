import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * OWASP-recommended scrypt profile. Each hash needs 128 * N * r bytes
 * (64 MiB), and several logins can run concurrently in one serverless
 * instance.
 */
const SCRYPT_COST = { N: 2 ** 16, r: 8, p: 2 };
const SCRYPT_KEYLEN = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

function runScrypt(password: string, salt: string, N: number, r: number, p: number): Promise<Buffer> {
  // Node rejects any call needing more than maxmem, which defaults to 32 MiB.
  return scryptAsync(password, salt, SCRYPT_KEYLEN, { N, r, p, maxmem: 2 * 128 * N * r });
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
  const [algorithm, n, r, p, salt, hash] = stored.split('$');
  const cost = [n, r, p].map(Number);
  if (algorithm !== 'scrypt' || !salt || !hash || !cost.every((v) => Number.isInteger(v) && v > 0)) {
    return false;
  }
  const candidate = await runScrypt(password, salt, cost[0], cost[1], cost[2]);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}
