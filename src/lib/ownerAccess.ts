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

declare const authenticated: unique symbol;
declare const owned: unique symbol;

export type AuthenticatedUser = { readonly id: ObjectId; readonly [authenticated]: true };
export type OwnedSite = { readonly owner: AuthenticatedUser; readonly site: Site; readonly [owned]: true };

/** A missing Site and another Owner's Site are the same denial: neither is yours. */
export type AccessDenial = 'unauthenticated' | 'notFound';

export function authenticate(sessionToken: string | undefined): AuthenticatedUser | null {
  const userId = verifySessionToken(sessionToken);
  if (!userId || !ObjectId.isValid(userId)) {
    return null;
  }
  return { id: new ObjectId(userId) } as AuthenticatedUser;
}

export async function accessOwnedSite(
  sessionToken: string | undefined,
  slug: string
): Promise<OwnedSite | AccessDenial> {
  const owner = authenticate(sessionToken);
  if (!owner) {
    return 'unauthenticated';
  }
  const site = await getSiteBySlug(slug);
  if (!site?.ownerId.equals(owner.id)) {
    return 'notFound';
  }
  return { owner, site } as OwnedSite;
}
