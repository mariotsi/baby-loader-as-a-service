import type { Migration } from '../lib/migrations.ts';

/**
 * Gives every Site the loading baby as its Site icon: Sites created before the
 * field existed are left without one. Adding a field the previous deployment
 * ignores keeps to the rule in migrations.ts.
 */
export const addSiteIcon: Migration = {
  id: '0006-add-site-icon',
  async up(db) {
    await db.collection('sites').updateMany({ icon: { $exists: false } }, { $set: { icon: null } });
  },
};
