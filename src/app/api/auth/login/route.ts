import { type NextRequest, NextResponse } from 'next/server';
import {
  authRateLimit,
  getUserByEmail,
  hashPassword,
  issueSessionToken,
  needsRehash,
  sessionCookieOptions,
  updatePasswordHash,
  verifyPassword,
} from '@/lib/auth';
import { routeError } from '@/lib/routeError';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return routeError(401, { code: 'wrongCredentials' });
  }

  // A hash made with an older cost is upgraded while the password is at hand.
  // The old hash still verifies, so a failed save only delays the upgrade.
  if (needsRehash(user.passwordHash)) {
    try {
      await updatePasswordHash(user._id, await hashPassword(password));
    } catch (err) {
      console.error('Failed to upgrade password hash', err);
    }
  }

  const token = issueSessionToken(user._id.toHexString());
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
