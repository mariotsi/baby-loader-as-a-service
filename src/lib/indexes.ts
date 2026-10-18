import type { Db, IndexDescription } from 'mongodb';

/**
 * Every index the app relies on. The unique ones back the uniqueness the
 * code otherwise only checks with a findOne before inserting: one User per
 * email, one Site per Slug and per Custom domain, one Subscriber per device
 * and Site.
 */
export const INDEXES: Record<string, IndexDescription[]> = {
  users: [{ key: { email: 1 }, unique: true }],
  tenants: [
    { key: { slug: 1 }, unique: true },
    { key: { ownerId: 1, createdAt: -1 } },
    // Most Sites have customDomain: null, so uniqueness applies only to set values.
    { key: { customDomain: 1 }, unique: true, partialFilterExpression: { customDomain: { $type: 'string' } } },
  ],
  subscriptions: [
    { key: { tenantId: 1, endpoint: 1 }, unique: true },
    { key: { tenantId: 1, createdAt: -1 } },
    { key: { endpoint: 1 } },
  ],
};

/** Creates the missing indexes; one that already exists with the same spec is left as it is. */
export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all(
    Object.entries(INDEXES).map(([collection, specs]) => db.collection(collection).createIndexes(specs))
  );
}
