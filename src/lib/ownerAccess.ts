import * as z from 'zod/mini';
import { isId } from '../db/index.ts';
import { verifySessionToken } from './auth.ts';
import { getSiteBySlug, type Site } from './site.ts';

/**
 * The one place that turns a session cookie into a User, and a User plus a
 * Slug into a Site they own. Writes to a Site accept only the values below,
 * and only this module creates them, so a caller that skips the check does
 * not compile. Free of Next imports; ownerAccessNext.ts adapts it to routes
 * and pages.
 */

/**
 * Anyone with a valid session, a password change pending or not. It is
 * enough to set a new password and nothing else.
 */
const signedInUserSchema = z.object({ id: z.string(), passwordChangePending: z.boolean() }).brand<'SignedInUser'>();
export type SignedInUser = Readonly<z.output<typeof signedInUserSchema>>;

/** A signed-in User with no password change pending. */
const authenticatedUserSchema = z.object({ id: z.string() }).brand<'AuthenticatedUser'>();
export type AuthenticatedUser = Readonly<z.output<typeof authenticatedUserSchema>>;

/** The Site's own checks ran when it was read; the brand says only that its owner is this User. */
const ownedSiteSchema = z.object({ owner: authenticatedUserSchema, site: z.custom<Site>() }).brand<'OwnedSite'>();
export type OwnedSite = Readonly<z.output<typeof ownedSiteSchema>>;

/**
 * A missing Site and another Owner's Site are the same denial: neither is
 * yours. A session whose password change is pending reaches no Site at all.
 */
export type AccessDenial = 'unauthenticated' | 'passwordChangePending' | 'notFound';

export function signIn(sessionToken: string | undefined): SignedInUser | null {
  const session = verifySessionToken(sessionToken);
  if (!session || !isId(session.userId)) {
    return null;
  }
  return signedInUserSchema.parse({ id: session.userId, passwordChangePending: session.passwordChangePending });
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
  return authenticatedUserSchema.parse({ id: user.id });
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
  if (site?.ownerId !== owner.id) {
    return 'notFound';
  }
  return ownedSiteSchema.parse({ owner, site });
}
