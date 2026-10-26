import { createHash } from 'node:crypto';

/** Production's D1 database, bound only by the production Worker (wrangler.production.jsonc). */
export const PRODUCTION_DB_NAME = 'loading-baby';

/** Staging's D1 database, also the local one `npm run dev` and the local E2E server use. */
export const STAGING_DB_NAME = `${PRODUCTION_DB_NAME}-staging`;

const PREVIEW_PREFIX = `${PRODUCTION_DB_NAME}-`;
/** Keeps a branch's names short: its database, and its Preview alias next to the Worker's name in one DNS label. */
const MAX_DB_NAME_LENGTH = 38;

/**
 * D1 database of one Git branch's Preview: "loading-baby-<branch>",
 * lowercased, with each run of characters outside [a-z0-9] turned into one
 * "-". Branches that differ only in punctuation (feat/x, feat-x) therefore
 * share a database. A name over MAX_DB_NAME_LENGTH is truncated and suffixed
 * with a hash of the full branch name, so long branches sharing a prefix get
 * distinct databases.
 */
export function previewDbName(branch: string): string {
  const safe = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!safe) {
    throw new Error(`Branch "${branch}" has no characters usable in a database name`);
  }
  const name = PREVIEW_PREFIX + safe;
  if (name.length <= MAX_DB_NAME_LENGTH) {
    return name;
  }
  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);
  return `${name.slice(0, MAX_DB_NAME_LENGTH - hash.length - 1).replace(/-+$/, '')}-${hash}`;
}

/**
 * Whether a name belongs to a preview deployment: the prefix followed by a
 * non-empty branch part. PRODUCTION_DB_NAME never matches. STAGING_DB_NAME
 * does, since it is previewDbName('staging'), so callers that must spare
 * staging check for it separately.
 */
export function isPreviewDbName(name: string): boolean {
  return name.startsWith(PREVIEW_PREFIX) && name.length > PREVIEW_PREFIX.length;
}

/**
 * Which test data the E2E data script may write to a database:
 * - fixtures: the fixed set of `e2e-` Users and Sites, reset on every run;
 * - demo: Users and Sites for people reviewing a preview by hand.
 * A local database takes both. Remotely a Preview's database takes both,
 * staging's takes fixtures only, and any other, production's included, takes
 * nothing.
 */
export function testDataPolicy(target: { local: boolean; dbName: string }): { fixtures: boolean; demo: boolean } {
  if (target.local) {
    return { fixtures: true, demo: true };
  }
  if (target.dbName === STAGING_DB_NAME) {
    return { fixtures: true, demo: false };
  }
  if (isPreviewDbName(target.dbName)) {
    return { fixtures: true, demo: true };
  }
  return { fixtures: false, demo: false };
}
