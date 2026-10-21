import type { Migration } from '../lib/migrations.ts';

/**
 * Moves storage to the glossary's names: the `tenants` collection becomes
 * `sites`, and each subscription's `tenantId` becomes `siteId`, with the
 * indexes keyed on `tenantId` dropped (indexes.ts creates the `siteId` ones
 * once migrations finish).
 *
 * The one migration that breaks the rule in migrations.ts: the previous
 * deployment reads `tenants` and `tenantId`, so it finds no Site until it
 * stops serving, a Site it writes meanwhile lands in a stray `tenants`, and
 * an instant rollback past this deployment does not work. Fix forward.
 */
export const renameTenantsToSites: Migration = {
  id: '0001-rename-tenants-to-sites',
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: applied migrations keep the code they ran with.
  async up(db) {
    const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

    if (collections.has('tenants')) {
      if (collections.has('sites')) {
        // A rerun after the rename leaves an empty `tenants` only if the previous deployment recreated it.
        if (await db.collection('sites').countDocuments({}, { limit: 1 })) {
          if (await db.collection('tenants').countDocuments({}, { limit: 1 })) {
            throw new Error('Both `tenants` and `sites` hold documents; merge them by hand before migrating');
          }
        } else {
          await db.collection('sites').drop();
          await db.collection('tenants').rename('sites');
        }
      } else {
        await db.collection('tenants').rename('sites');
      }
    }

    if (collections.has('subscriptions')) {
      const subscriptions = db.collection('subscriptions');
      await subscriptions.updateMany({ tenantId: { $exists: true } }, { $rename: { tenantId: 'siteId' } });
      for (const index of await subscriptions.indexes()) {
        if (index.name && 'tenantId' in index.key) {
          await subscriptions.dropIndex(index.name);
        }
      }
    }
  },
};
