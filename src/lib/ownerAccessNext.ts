import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from './auth.ts';
import {
  type AccessDenial,
  type AuthenticatedUser,
  accessOwnedSite,
  authenticateOrDeny,
  type OwnedSite,
  type SignedInUser,
  signIn,
} from './ownerAccess.ts';
import { routeError } from './routeError.ts';

/**
 * Owner access for Route Handlers and Dashboard pages. Routes answer 401 with
 * no session, 403 while a password change is pending, and 404 for a Site that
 * is missing or not the session's; pages redirect to /login and to the
 * change-password page, and render the 404 page.
 */

/** The change-password page, where a session with a password change pending is sent. */
export const CHANGE_PASSWORD_PATH = '/account/password';

const DENIAL_RESPONSES: Record<AccessDenial, () => NextResponse> = {
  unauthenticated: () => routeError(401, { code: 'notAuthenticated' }),
  passwordChangePending: () => routeError(403, { code: 'passwordChangePending' }),
  notFound: () => routeError(404, { code: 'notFound' }),
};

export function requireUser(req: NextRequest): { user: AuthenticatedUser } | { error: NextResponse } {
  const user = authenticateOrDeny(req.cookies.get(SESSION_COOKIE)?.value);
  return typeof user === 'string' ? { error: DENIAL_RESPONSES[user]() } : { user };
}

/** Any signed-in User, a password change pending or not: only the change-password route takes it. */
export function requireSignedIn(req: NextRequest): { user: SignedInUser } | { error: NextResponse } {
  const user = signIn(req.cookies.get(SESSION_COOKIE)?.value);
  return user ? { user } : { error: DENIAL_RESPONSES.unauthenticated() };
}

export async function requireOwnedSite(
  req: NextRequest,
  slug: string
): Promise<{ owned: OwnedSite } | { error: NextResponse }> {
  const access = await accessOwnedSite(req.cookies.get(SESSION_COOKIE)?.value, slug);
  return typeof access === 'string' ? { error: DENIAL_RESPONSES[access]() } : { owned: access };
}

async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

function pageDenial(denial: AccessDenial): never {
  if (denial === 'unauthenticated') {
    redirect('/login');
  }
  if (denial === 'passwordChangePending') {
    redirect(CHANGE_PASSWORD_PATH);
  }
  notFound();
}

export async function pageUser(): Promise<AuthenticatedUser> {
  const user = authenticateOrDeny(await sessionToken());
  return typeof user === 'string' ? pageDenial(user) : user;
}

/** Any signed-in User, a password change pending or not: only the change-password page takes it. */
export async function pageSignedIn(): Promise<SignedInUser> {
  return signIn(await sessionToken()) ?? pageDenial('unauthenticated');
}

export async function pageOwnedSite(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(await sessionToken(), slug);
  return typeof access === 'string' ? pageDenial(access) : access;
}
