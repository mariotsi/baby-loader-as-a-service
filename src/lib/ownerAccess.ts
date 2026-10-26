import { ObjectId } from 'mongodb';
import { verifySessionToken } from './auth.ts';
import { getSiteBySlug, type Site } from './site.ts';

/**
 * The one place that turns a session cookie into a User, and a User plus a
 * Slug into a Site they own. Writes to a Site accept only the values below,
 * and only this module creates them, so a caller that skips the check does
 * not compile. Free of Next imports; ownerAccessNext.ts adapts it to routes
 * and pages.
 */

declare const signedIn: unique symbol;
declare const authenticated: unique symbol;
declare const owned: unique symbol;

/**
 * Anyone with a valid session, a password change pending or not. It is
 * enough to set a new password and nothing else.
 */
export type SignedInUser = {
  readonly id: ObjectId;
  readonly passwordChangePending: boolean;
  readonly [signedIn]: true;
};
/** A signed-in User with no password change pending. */
export type AuthenticatedUser = { readonly id: ObjectId; readonly [authenticated]: true };
export type OwnedSite = { readonly owner: AuthenticatedUser; readonly site: Site; readonly [owned]: true };

/**
 * A missing Site and another Owner's Site are the same denial: neither is
 * yours. A session whose password change is pending reaches no Site at all.
 */
export type AccessDenial = 'unauthenticated' | 'passwordChangePending' | 'notFound';

export function signIn(sessionToken: string | undefined): SignedInUser | null {
  const session = verifySessionToken(sessionToken);
  if (!session || !ObjectId.isValid(session.userId)) {
    return null;
  }
  return { id: new ObjectId(session.userId), passwordChangePending: session.passwordChangePending } as SignedInUser;
}

/** The session's User, or why there is none. */
export function authenticateOrDeny(
  sessionToken: string | undefined
): AuthenticatedUser | 'unauthenticated' | 'passwordChangePending' {
  const user = signIn(sessionToken);
  if (!user) {
    return 'unauthenticated';
  }
  if (user.passwordChangePending) {
    return 'passwordChangePending';
  }
  return { id: user.id } as AuthenticatedUser;
}

export function authenticate(sessionToken: string | undefined): AuthenticatedUser | null {
  const user = authenticateOrDeny(sessionToken);
  return typeof user === 'string' ? null : user;
}

export async function accessOwnedSite(
  sessionToken: string | undefined,
  slug: string
): Promise<OwnedSite | AccessDenial> {
  const owner = authenticateOrDeny(sessionToken);
  if (typeof owner === 'string') {
    return owner;
  }
  const site = await getSiteBySlug(slug);
  if (!site?.ownerId.equals(owner.id)) {
    return 'notFound';
  }
  return { owner, site } as OwnedSite;
}
