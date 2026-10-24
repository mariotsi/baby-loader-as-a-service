import type { Migration } from '../lib/migrations.ts';

/**
 * Gives every Site a Signature, empty in every language: Sites created before
 * the field existed are left unsigned. Adding a field the previous deployment
 * ignores keeps to the rule in migrations.ts.
 */
export const addSiteSignature: Migration = {
  id: '0004-add-site-signature',
  async up(db) {
    await db.collection('sites').updateMany({ signature: { $exists: false } }, { $set: { signature: {} } });
  },
};
