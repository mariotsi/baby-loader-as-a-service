import type { Migration } from '../lib/migrations.ts';
import { renameTenantsToSites } from './0001-rename-tenants-to-sites.ts';
import { addSiteTimezone } from './0002-add-site-timezone.ts';
import { addSiteLanguages } from './0003-add-site-languages.ts';
import { addSitePageName } from './0004-add-site-page-name.ts';
import { addMilestoneEmojiAndLabels } from './0005-add-milestone-emoji-and-labels.ts';

/**
 * Every data migration, in the order they run (see applyMigrations). Add one
 * as `src/migrations/NNNN-short-name.ts`, exporting a Migration whose id is
 * its file name, and append it here.
 */
export const MIGRATIONS: Migration[] = [
  renameTenantsToSites,
  addSiteTimezone,
  addSiteLanguages,
  addSitePageName,
  addMilestoneEmojiAndLabels,
];
