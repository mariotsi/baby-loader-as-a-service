import { createHash } from 'node:crypto';

/** Database of production and local development, unless MONGODB_DB_NAME says otherwise. */
export const DEFAULT_DB_NAME = 'waitingpages';

const PREVIEW_PREFIX = `${DEFAULT_DB_NAME}-`;
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
 * non-empty branch part. DEFAULT_DB_NAME, the production database, never
 * matches.
 */
export function isPreviewDbName(name: string): boolean {
  return name.startsWith(PREVIEW_PREFIX) && name.length > PREVIEW_PREFIX.length;
}

/**
 * The database a deployment uses: MONGODB_DB_NAME when set, the branch's
 * previewDbName on a Vercel preview deployment, DEFAULT_DB_NAME otherwise.
 * MongoDB creates a database on its first write, so a new branch needs no
 * provisioning.
 */
export function databaseName(env: Record<string, string | undefined>): string {
  if (env.MONGODB_DB_NAME) {
    return env.MONGODB_DB_NAME;
  }
  if (env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF) {
    return previewDbName(env.VERCEL_GIT_COMMIT_REF);
  }
  return DEFAULT_DB_NAME;
}
