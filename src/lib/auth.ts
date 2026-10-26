import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { getDb, isId, isUniqueViolation, newId } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { addressEnv, sessionSecret } from './env.ts';
import { hashPassword, PASSWORD_GENERATIONS, type PasswordGeneration, verifyPassword } from './password.ts';
import { rateLimit } from './rateLimit.ts';
import { readSessionToken, type Session, signSessionToken } from './sessionToken.ts';

export { hashPassword };

export const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type User = typeof users.$inferSelect;

// --- Accounts ----------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<User | null> {
  const user = await getDb().query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  return user ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!isId(id)) {
    return null;
  }
  const user = await getDb().query.users.findFirst({ where: eq(users.id, id) });
  return user ?? null;
}

/** Thrown by createUser when the email already has an account. */
export class EmailTakenError extends Error {}

/** The unique email column decides whether an email is taken. */
export async function createUser(email: string, password: string): Promise<User> {
  const user: User = {
    id: newId(),
    email: email.trim().toLowerCase(),
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  try {
    await getDb().insert(users).values(user);
  } catch (err) {
    if (isUniqueViolation(err, 'users.email')) {
      throw new EmailTakenError(undefined, { cause: err });
    }
    throw err;
  }
  return user;
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await getDb().update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export type LogInResult =
  | { ok: true; user: User; passwordChangePending: boolean }
  | { ok: false; code: 'wrongCredentials' | 'passwordResetRequired' };

/**
 * Checks an email and password, and does what the stored hash's generation
 * asks: a `rehash` hash is replaced with a current one, a `change` hash
 * signs in with a password change pending, and the right password for a
 * `retired` hash is refused with passwordResetRequired.
 */
export async function logIn(
  email: string,
  password: string,
  generations: readonly PasswordGeneration[] = PASSWORD_GENERATIONS
): Promise<LogInResult> {
  const user = await getUserByEmail(email);
  const check = user ? await verifyPassword(password, user.passwordHash, generations) : 'invalid';
  if (!user || check === 'invalid') {
    return { ok: false, code: 'wrongCredentials' };
  }
  if (check === 'reset') {
    return { ok: false, code: 'passwordResetRequired' };
  }
  if (check === 'rehash') {
    // The old hash still verifies, so a failed save only puts the upgrade off to the next login.
    try {
      await updatePasswordHash(user.id, await hashPassword(password));
    } catch (err) {
      console.error('Failed to rehash a password', err);
    }
  }
  return { ok: true, user, passwordChangePending: check === 'change' };
}

// --- Sessions ----------------------------------------------------------------

export function issueSessionToken(userId: string, { passwordChangePending = false } = {}): string {
  return signSessionToken({ userId, passwordChangePending }, Date.now() + SESSION_TTL_MS, sessionSecret());
}

/** Returns the session a token carries, or null if the token is missing/invalid/expired. */
export function verifySessionToken(token: string | undefined): Session | null {
  return readSessionToken(token, sessionSecret());
}

export function sessionCookieOptions(maxAge = SESSION_TTL_MS / 1000) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    // A production build served on localhost (the local E2E server) runs over
    // plain http, where Safari and WebKit refuse to send a Secure cookie.
    secure: process.env.NODE_ENV === 'production' && addressEnv().protocol === 'https',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/** Shared rate limit for auth endpoints (signup/login), keyed by client IP. */
export function authRateLimit(req: NextRequest): boolean {
  return rateLimit(`auth:${clientIp(req)}`, 10, 60_000);
}
