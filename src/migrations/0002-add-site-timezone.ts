import type { Migration } from '../lib/migrations.ts';

/**
 * Gives every Site a Timezone, so its Countdown and Birth details are told in
 * local time. Sites created before the field existed get Europe/Rome, where
 * the Platform's first Owners live. Adding a field the previous deployment
 * ignores keeps to the rule in migrations.ts.
 */
export const addSiteTimezone: Migration = {
  id: '0002-add-site-timezone',
  async up(db) {
    await db.collection('sites').updateMany({ timezone: { $exists: false } }, { $set: { timezone: 'Europe/Rome' } });
  },
};
