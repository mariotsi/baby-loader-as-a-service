import { type NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { authRateLimit, hashPassword, issueSessionToken, sessionCookieOptions, updatePasswordHash } from '@/lib/auth';
import { requireSignedIn } from '@/lib/ownerAccessNext';
import { newPasswordProblem } from '@/lib/passwordRules';
import { routeError } from '@/lib/routeError';

/**
 * Sets the signed-in User's password, hashed with the current generation, and
 * answers with a session that no longer has a password change pending.
 */
export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return routeError(429, { code: 'rateLimited' });
  }
  const auth = requireSignedIn(req);
  if ('error' in auth) {
    return auth.error;
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  const passwordProblem = newPasswordProblem(password);
  if (passwordProblem) {
    logActivity('user.passwordChange', { ok: false, reason: passwordProblem.code, userId: auth.user.id });
    return routeError(400, passwordProblem);
  }

  await updatePasswordHash(auth.user.id, await hashPassword(password));
  logActivity('user.passwordChange', { ok: true, userId: auth.user.id });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: issueSessionToken(auth.user.id) });
  return res;
}
