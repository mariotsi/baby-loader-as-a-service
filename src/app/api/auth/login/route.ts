import { type NextRequest, NextResponse } from 'next/server';
import { authRateLimit, getUserByEmail, issueSessionToken, sessionCookieOptions, verifyPassword } from '@/lib/auth';
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

  const token = issueSessionToken(user._id.toHexString());
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
