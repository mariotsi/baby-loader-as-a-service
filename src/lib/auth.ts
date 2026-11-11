import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { isUserId, newUserId, type UserId } from '../db/ids.ts';
import { getDb, isUniqueViolation } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { type Email, emailSchema } from './email.ts';
import { addressEnv, sessionSecret } from './env.ts';
import {
  hashPassword,
  PASSWORD_GENERATIONS,
  type PasswordGeneration,
  type PasswordHash,
  verifyPassword,
} from './password.ts';
import { rateLimit } from './rateLimit.ts';
import { readSessionToken, type Session, type SessionToken, signSessionToken } from './sessionToken.ts';

export { hashPassword };

export const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type User = typeof users.$inferSelect;

// --- Accounts ----------------------------------------------------------------

/** The User with `email`, in any case and with any spaces round it; null for anything that is no email address. */
export async function getUserByEmail(email: unknown): Promise<User | null> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return null;
  }
  const user = await getDb().query.users.findFirst({ where: eq(users.email, parsed.data) });
  return user ?? null;
}

/** The User with `id`; null for anything that is not a User's id, so an id from a cookie or URL can be passed as is. */
export async function getUserById(id: unknown): Promise<User | null> {
  if (!isUserId(id)) {
    return null;
  }
  const user = await getDb().query.users.findFirst({ where: eq(users.id, id) });
  return user ?? null;
}

/** Thrown by createUser when the email already has an account. */
export class EmailTakenError extends Error {}

/** The unique email column decides whether an email is taken. */
export async function createUser(email: Email, password: string): Promise<User> {
  const user: User = {
    id: newUserId(),
    email,
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

export async function updatePasswordHash(userId: UserId, passwordHash: PasswordHash): Promise<void> {
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
  email: unknown,
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

export function issueSessionToken(userId: string, { passwordChangePending = false } = {}): SessionToken {
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

/** Cloudflare's own header first, which a client can't set; then the first proxy hop, which `next dev` sees. */
export function clientIp(req: NextRequest): string {
  const connecting = req.headers.get('cf-connecting-ip');
  if (connecting) {
    return connecting;
  }
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
