import { type NextRequest, NextResponse } from 'next/server';
import { authRateLimit, createUser, issueSessionToken, sessionCookieOptions } from '@/lib/auth';
import { newPasswordProblem } from '@/lib/passwordRules';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return NextResponse.json({ error: 'Too many attempts, try again in a minute.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const passwordProblem = newPasswordProblem(password);
  if (passwordProblem) {
    return NextResponse.json({ error: passwordProblem }, { status: 400 });
  }

  try {
    const user = await createUser(email, password);
    const token = issueSessionToken(user._id.toHexString());
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
