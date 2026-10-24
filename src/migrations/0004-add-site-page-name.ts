import type { Migration } from '../lib/migrations.ts';

/**
 * Gives every Site a Page name, empty in every language: Sites created before
 * the field existed are left without one. Adding a field the previous deployment
 * ignores keeps to the rule in migrations.ts.
 */
export const addSitePageName: Migration = {
  id: '0004-add-site-page-name',
  async up(db) {
    await db.collection('sites').updateMany({ pageName: { $exists: false } }, { $set: { pageName: {} } });
  },
};
