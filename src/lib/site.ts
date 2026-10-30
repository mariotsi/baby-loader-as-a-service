import { and, desc, eq } from 'drizzle-orm';
import { getDb, isId, isUniqueViolation, newId } from '../db/index.ts';
import { sites } from '../db/schema.ts';
import type { AuthenticatedUser, OwnedSite } from './ownerAccess.ts';
import type {
  BirthDetails,
  BirthMedia,
  SiteSettings,
  SiteSettingsError,
  ValidNewSite,
  ValidSiteSettings,
} from './siteSettings.ts';

export type { Milestone } from './siteSettings.ts';

/** One Site: its Site settings plus what the Owner never edits directly. */
export type Site = SiteSettings & {
  id: string;
  slug: string;
  ownerId: string;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** ISO 8601 UTC. */
  updatedAt: string;

  /** Populated once custom-domain support (plan phase 7) is built. */
  customDomain: string | null;
  customDomainVerified: boolean;
};

/** Serializable form, safe to send to the client. */
export type SiteDTO = Site;

export function toSiteDTO(site: Site): SiteDTO {
  return site;
}

type SiteRow = typeof sites.$inferSelect;

function fromRow({ settings, ...row }: SiteRow): Site {
  return { ...withBirthVideo(settings), ...row };
}

/** Rows saved before the Birth video left the Birth details keep it there, or have none. */
function withBirthVideo(settings: SiteSettings): SiteSettings {
  if (settings.birthVideo !== undefined) {
    return settings;
  }
  const legacy = settings.birth.details as (BirthDetails & { video?: BirthMedia | null }) | null;
  if (!legacy || !('video' in legacy)) {
    return { ...settings, birthVideo: null };
  }
  const { video, ...details } = legacy;
  return { ...settings, birth: { born: true, details }, birthVideo: video ?? null };
}

export async function getSiteBySlug(slug: string): Promise<Site | null> {
  const row = await getDb().query.sites.findFirst({ where: eq(sites.slug, slug.toLowerCase()) });
  return row ? fromRow(row) : null;
}

export async function getSiteByCustomDomain(domain: string): Promise<Site | null> {
  const row = await getDb().query.sites.findFirst({
    where: and(eq(sites.customDomain, domain.toLowerCase()), eq(sites.customDomainVerified, true)),
  });
  return row ? fromRow(row) : null;
}

export async function getSiteById(id: string): Promise<Site | null> {
  if (!isId(id)) {
    return null;
  }
  const row = await getDb().query.sites.findFirst({ where: eq(sites.id, id) });
  return row ? fromRow(row) : null;
}

export async function listSitesByOwner(owner: AuthenticatedUser): Promise<Site[]> {
  const rows = await getDb().query.sites.findMany({
    where: eq(sites.ownerId, owner.id),
    orderBy: desc(sites.createdAt),
  });
  return rows.map(fromRow);
}

export type CreateSiteResult = { ok: true; site: Site } | { ok: false; errors: SiteSettingsError[] };

/** The unique `slug` column decides whether a Slug is taken. */
export async function createSite(owner: AuthenticatedUser, newSite: ValidNewSite): Promise<CreateSiteResult> {
  const now = new Date().toISOString();
  const row: SiteRow = {
    id: newId(),
    slug: newSite.slug,
    ownerId: owner.id,
    settings: newSite.settings,
    customDomain: null,
    customDomainVerified: false,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await getDb().insert(sites).values(row);
  } catch (err) {
    if (isUniqueViolation(err, 'sites.slug')) {
      return { ok: false, errors: [{ path: 'slug', code: 'slugTaken' }] };
    }
    throw err;
  }
  return { ok: true, site: fromRow(row) };
}

/** Replaces every Site setting at once. Null when the Site no longer exists. */
export async function saveSiteSettings(owned: OwnedSite, settings: ValidSiteSettings): Promise<Site | null> {
  const [row] = await getDb()
    .update(sites)
    .set({ settings, updatedAt: new Date().toISOString() })
    .where(and(eq(sites.id, owned.site.id), eq(sites.ownerId, owned.owner.id)))
    .returning();
  return row ? fromRow(row) : null;
}
