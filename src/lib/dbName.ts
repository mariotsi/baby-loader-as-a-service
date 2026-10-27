import { createHash } from 'node:crypto';

/** Production's D1 database, bound only by the production Worker (wrangler.production.jsonc). */
export const PRODUCTION_DB_NAME = 'loading-baby';

/** Staging's D1 database, also the local one `npm run dev` and the local E2E server use. */
export const STAGING_DB_NAME = `${PRODUCTION_DB_NAME}-staging`;

/**
 * The Preview pool (ADR-0009): D1 databases created once by hand, each lent to
 * one branch's Preview at a time and recorded in its one-row `preview_slot`
 * table (scripts/preview-pool.mjs). CI never creates or deletes a database,
 * so a Preview can only ever bind one of these. Grow the pool by creating
 * `loading-baby-preview-<n+1>` and adding it here.
 */
export const PREVIEW_POOL: readonly { name: string; id: string }[] = [
  { name: `${PRODUCTION_DB_NAME}-preview-1`, id: '5fff7f48-8502-4480-b0a6-9400a1d438a5' },
  { name: `${PRODUCTION_DB_NAME}-preview-2`, id: 'e15e41a8-1f8e-4adc-ac21-2787a3e5a659' },
  { name: `${PRODUCTION_DB_NAME}-preview-3`, id: '5dc06af8-9ba6-4804-b0de-d3e32afb0f75' },
  { name: `${PRODUCTION_DB_NAME}-preview-4`, id: '2b95f4d4-2c0c-46db-a918-900676ef59c4' },
  { name: `${PRODUCTION_DB_NAME}-preview-5`, id: 'c17abc1b-6b31-492b-980b-891234428397' },
];

/** Whether a name is one of the Preview pool's databases. */
export function isPreviewDbName(name: string): boolean {
  return PREVIEW_POOL.some((db) => db.name === name);
}

/** The Worker the Previews belong to: its name follows each Preview's in their workers.dev host. */
const PREVIEW_WORKER = 'loading-baby-staging';
/** A DNS label holds 63 characters: `<preview name>-<PREVIEW_WORKER>`. */
const MAX_PREVIEW_NAME_LENGTH = 63 - PREVIEW_WORKER.length - 1;

/**
 * Name of one Git branch's Preview, the first label of its workers.dev host:
 * the branch lowercased, with each run of characters outside [a-z0-9] turned
 * into one "-", and a leading "b-" when it would start with a digit. A name
 * too long for the host is truncated and suffixed with a hash of the full
 * branch name, so long branches sharing a prefix get distinct Previews.
 */
export function previewName(branch: string): string {
  let safe = branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!safe) {
    throw new Error(`Branch "${branch}" has no characters usable in a Preview name`);
  }
  if (!/^[a-z]/.test(safe)) {
    safe = `b-${safe}`;
  }
  if (safe.length <= MAX_PREVIEW_NAME_LENGTH) {
    return safe;
  }
  const hash = createHash('sha256').update(branch).digest('hex').slice(0, 8);
  return `${safe.slice(0, MAX_PREVIEW_NAME_LENGTH - hash.length - 1).replace(/-+$/, '')}-${hash}`;
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
