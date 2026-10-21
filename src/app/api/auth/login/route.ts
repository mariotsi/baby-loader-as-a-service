import { type NextRequest, NextResponse } from 'next/server';
import { authRateLimit, getUserByEmail, issueSessionToken, sessionCookieOptions, verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return NextResponse.json({ error: 'Too many attempts, try again in a minute.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const token = issueSessionToken(user._id.toHexString());
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...sessionCookieOptions(), value: token });
  return res;
}
