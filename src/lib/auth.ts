import { createHmac, timingSafeEqual } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { NextRequest } from 'next/server';
import { addressEnv, sessionSecret } from './env.ts';
import { getDb } from './mongodb.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { rateLimit } from './rateLimit.ts';

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface User {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

async function usersCollection() {
  const db = await getDb();
  return db.collection<User>('users');
}

// --- Accounts ----------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<User | null> {
  const col = await usersCollection();
  return col.findOne({ email: email.trim().toLowerCase() });
}

export async function getUserById(id: string): Promise<User | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const col = await usersCollection();
  return col.findOne({ _id: new ObjectId(id) });
}

/** Thrown by createUser when the email already has an account. */
export class EmailTakenError extends Error {}

export async function createUser(email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();
  const col = await usersCollection();
  const existing = await col.findOne({ email: normalizedEmail });
  if (existing) {
    throw new EmailTakenError();
  }
  const user: User = {
    _id: new ObjectId(),
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  };
  await col.insertOne(user);
  return user;
}

// --- Sessions ----------------------------------------------------------------

function sign(value: string): string {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function issueSessionToken(userId: string): string {
  const expiresAt = String(Date.now() + SESSION_TTL_MS);
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the authenticated user's id, or null if the token is missing/invalid/expired. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) {
    return null;
  }
  const [userId, expiresAt, signature] = token.split('.');
  if (!userId || !expiresAt || !signature) {
    return null;
  }
  const payload = `${userId}.${expiresAt}`;
  const expected = sign(payload);
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  if (Number(expiresAt) <= Date.now()) {
    return null;
  }
  return userId;
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
