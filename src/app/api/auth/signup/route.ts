import { type NextRequest, NextResponse } from 'next/server';
import { authRateLimit, createUser, EmailTakenError, issueSessionToken, sessionCookieOptions } from '@/lib/auth';
import { emailSchema } from '@/lib/email';
import { newPasswordProblem } from '@/lib/passwordRules';
import { routeError } from '@/lib/routeError';

export async function POST(req: NextRequest) {
  if (!authRateLimit(req)) {
    return routeError(429, { code: 'rateLimited' });
  }

  const body = await req.json().catch(() => null);
  const email = emailSchema.safeParse(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email.success) {
    return routeError(400, { code: 'invalidEmail' });
  }
  const passwordProblem = newPasswordProblem(password);
  if (passwordProblem) {
    return routeError(400, passwordProblem);
  }

  try {
    const user = await createUser(email.data, password);
    const token = issueSessionToken(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return routeError(409, { code: 'emailTaken' });
    }
    throw err;
  }
}
