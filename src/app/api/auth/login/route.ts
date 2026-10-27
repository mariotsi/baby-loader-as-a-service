import { type NextRequest, NextResponse } from 'next/server';
import { authRateLimit, issueSessionToken, logIn, sessionCookieOptions } from '@/lib/auth';
import { routeError } from '@/lib/routeError';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const result = await logIn(email, password);
  if (!result.ok) {
    return routeError(401, { code: result.code });
  }

  const token = issueSessionToken(result.user.id, {
    passwordChangePending: result.passwordChangePending,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
