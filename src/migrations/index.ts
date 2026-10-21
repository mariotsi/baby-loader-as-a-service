import type { Migration } from '../lib/migrations.ts';

/**
 * Every data migration, in the order they run (see applyMigrations). Add one
 * as `src/migrations/NNNN-short-name.ts`, exporting a Migration whose id is
 * its file name, and append it here.
 */
export const MIGRATIONS: Migration[] = [];
