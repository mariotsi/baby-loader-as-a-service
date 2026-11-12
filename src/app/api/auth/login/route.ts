import { type NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { authRateLimit, issueSessionToken, logIn, sessionCookieOptions } from '@/lib/auth';
import { routeError } from '@/lib/routeError';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    logActivity('user.login', { ok: false, reason: 'rateLimited' });
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const email = body?.email;
  const password = typeof body?.password === 'string' ? body.password : '';

  const result = await logIn(email, password);
  if (!result.ok) {
    logActivity('user.login', { ok: false, reason: result.code });
    return routeError(401, { code: result.code });
  }

  logActivity('user.login', {
    ok: true,
    userId: result.user.id,
    passwordChangePending: result.passwordChangePending,
  });
  const token = issueSessionToken(result.user.id, {
    passwordChangePending: result.passwordChangePending,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
