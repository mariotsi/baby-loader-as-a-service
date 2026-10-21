import { MongoServerError, ObjectId } from 'mongodb';
import { getDb } from './mongodb.ts';
import type { AuthenticatedUser, OwnedSite } from './ownerAccess.ts';
import type { SiteSettings, SiteSettingsError, ValidNewSite, ValidSiteSettings } from './siteSettings.ts';

export type { Milestone } from './siteSettings.ts';

/** One Site's document: its Site settings plus what the Owner never edits directly. */
export type Site = SiteSettings & {
  _id: ObjectId;
  slug: string;
  ownerId: ObjectId;
  createdAt: Date;
  updatedAt: Date;

  /** Populated once custom-domain support (plan phase 7) is built. */
  customDomain: string | null;
  customDomainVerified: boolean;
};

/** Serializable form, safe to send to the client (ids/dates as strings). */
export type SiteDTO = Omit<Site, '_id' | 'ownerId' | 'createdAt' | 'updatedAt'> & {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export function toSiteDTO(site: Site): SiteDTO {
  const { _id, ownerId, createdAt, updatedAt, ...rest } = site;
  return {
    ...rest,
    id: _id.toHexString(),
    ownerId: ownerId.toHexString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

async function collection() {
  const db = await getDb();
  return db.collection<Site>('sites');
}

export async function getSiteBySlug(slug: string): Promise<Site | null> {
  const col = await collection();
  return col.findOne({ slug: slug.toLowerCase() });
}

export async function getSiteByCustomDomain(domain: string): Promise<Site | null> {
  const col = await collection();
  return col.findOne({ customDomain: domain.toLowerCase(), customDomainVerified: true });
}

export async function getSiteById(id: string): Promise<Site | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const col = await collection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function listSitesByOwner(owner: AuthenticatedUser): Promise<Site[]> {
  const col = await collection();
  return col.find({ ownerId: owner.id }).sort({ createdAt: -1 }).toArray();
}

export type CreateSiteResult = { ok: true; site: Site } | { ok: false; errors: SiteSettingsError[] };

/** The unique index on `slug` (see indexes.ts) decides whether a Slug is taken. */
export async function createSite(owner: AuthenticatedUser, newSite: ValidNewSite): Promise<CreateSiteResult> {
  const now = new Date();
  const site: Site = {
    ...newSite.settings,
    _id: new ObjectId(),
    slug: newSite.slug,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
    customDomain: null,
    customDomainVerified: false,
  };
  const col = await collection();
  try {
    await col.insertOne(site);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000 && err.keyPattern?.slug) {
      return { ok: false, errors: [{ path: 'slug', code: 'slugTaken' }] };
    }
    throw err;
  }
  return { ok: true, site };
}

/** Replaces every Site setting at once. Null when the Site no longer exists. */
export async function saveSiteSettings(owned: OwnedSite, settings: ValidSiteSettings): Promise<Site | null> {
  const col = await collection();
  return col.findOneAndUpdate(
    { _id: owned.site._id, ownerId: owned.owner.id },
    { $set: { ...settings, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
}
