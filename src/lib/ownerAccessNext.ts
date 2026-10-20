import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SESSION_COOKIE } from './auth.ts';
import { accessOwnedSite, authenticate, type AuthenticatedUser, type OwnedSite } from './ownerAccess.ts';

/**
 * Owner access for Route Handlers and Dashboard pages. Routes answer 401 with
 * no session and 404 for a Site that is missing or not the session's; pages
 * redirect to /login and render the 404 page.
 */

const unauthenticated = () => NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
const notFoundResponse = () => NextResponse.json({ error: 'Not found.' }, { status: 404 });

export function requireUser(req: NextRequest): { user: AuthenticatedUser } | { error: NextResponse } {
  const user = authenticate(req.cookies.get(SESSION_COOKIE)?.value);
  return user ? { user } : { error: unauthenticated() };
}

export async function requireOwnedSite(
  req: NextRequest,
  slug: string
): Promise<{ owned: OwnedSite } | { error: NextResponse }> {
  const access = await accessOwnedSite(req.cookies.get(SESSION_COOKIE)?.value, slug);
  if (access === 'unauthenticated') {
    return { error: unauthenticated() };
  }
  if (access === 'notFound') {
    return { error: notFoundResponse() };
  }
  return { owned: access };
}

async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function pageUser(): Promise<AuthenticatedUser> {
  const user = authenticate(await sessionToken());
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function pageOwnedSite(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(await sessionToken(), slug);
  if (access === 'unauthenticated') {
    redirect('/login');
  }
  if (access === 'notFound') {
    notFound();
  }
  return access;
}
