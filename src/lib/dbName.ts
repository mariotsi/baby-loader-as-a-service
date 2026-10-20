import { createHash } from 'node:crypto';

/** Production's database, on the production cluster. No fallback ever resolves to it. */
export const PRODUCTION_DB_NAME = 'waitingpages';

/** Staging's database, on the non-production cluster; also the fallback when nothing names one. */
export const STAGING_DB_NAME = `${PRODUCTION_DB_NAME}-staging`;

const PREVIEW_PREFIX = `${PRODUCTION_DB_NAME}-`;
const MAX_DB_NAME_LENGTH = 64; // MongoDB's limit, in bytes

/**
 * Database of one Git branch's preview deployments: "waitingpages-<branch>",
 * lowercased, with each run of characters outside [a-z0-9] turned into one
 * "-". Branches that differ only in punctuation (feat/x, feat-x) therefore
 * share a database. A name over MongoDB's limit is truncated and suffixed
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
 * The database a deployment uses: MONGODB_DB_NAME when set, the branch's
 * previewDbName on a Vercel preview deployment, STAGING_DB_NAME otherwise.
 * A production deployment must set MONGODB_DB_NAME: without it the app
 * refuses to start, so a missing variable never resolves to production's
 * database, nor sends production traffic to staging's. MongoDB creates a
 * database on its first write, so a new branch needs no provisioning.
 */
export function databaseName(env: Record<string, string | undefined>): string {
  if (env.MONGODB_DB_NAME) {
    return env.MONGODB_DB_NAME;
  }
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF) {
    return previewDbName(env.VERCEL_GIT_COMMIT_REF);
  }
  if (env.VERCEL_ENV === 'production') {
    throw new Error('MONGODB_DB_NAME must be set on production deployments');
  }
  return STAGING_DB_NAME;
}

/** Whether a MongoDB connection string points only at this machine. */
export function isLocalMongoUri(uri: string): boolean {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri);
  if (!match) {
    return false;
  }
  return match[1].split(',').every((host) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host));
}

/**
 * Which test data the E2E data script may write to a database:
 * - fixtures: the fixed set of `e2e-` Users and Sites, reset on every run;
 * - demo: Users and Sites for people reviewing a preview by hand.
 * A local server takes both. Elsewhere a preview database takes both, staging
 * takes fixtures only, and any other database, production's included, takes
 * nothing.
 */
export function testDataPolicy(uri: string, dbName: string): { fixtures: boolean; demo: boolean } {
  if (isLocalMongoUri(uri)) {
    return { fixtures: true, demo: true };
  }
  if (dbName === STAGING_DB_NAME) {
    return { fixtures: true, demo: false };
  }
  if (isPreviewDbName(dbName)) {
    return { fixtures: true, demo: true };
  }
  return { fixtures: false, demo: false };
}
