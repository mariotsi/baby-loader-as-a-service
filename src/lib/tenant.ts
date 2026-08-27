import { ObjectId } from 'mongodb';
import { getDb } from './mongodb';
import type { Lang } from './i18n';
import { DEFAULT_PALETTE, DEFAULT_FONT, isPaletteId, isFontId } from './theme';

/** 'both' means the tenant's public page ships a language switcher. */
export type TenantLanguageMode = Lang | 'both';

export type BabySex = 'female' | 'male' | 'unknown';

export interface Milestone {
  label: string;
  date: string; // ISO
}

export interface TenantTheme {
  palette: string;
  font: string;
}

export interface TenantPrivacy {
  showName: boolean;
  showSex: boolean;
}

export interface Tenant {
  _id: ObjectId;
  slug: string;
  ownerId: ObjectId;
  createdAt: Date;
  updatedAt: Date;

  babyName: string;
  sex: BabySex;
  /** Expected arrival date, shown by the countdown. ISO date string. */
  dueDate: string | null;
  /** Set once the baby is born — switches the public page to the "born" state. */
  birthDatetime: string | null;
  weight: number | null;
  lengthCm: number | null;
  birthMessage: string;
  birthMessageEn: string;
  milestones: Milestone[];

  language: TenantLanguageMode;
  theme: TenantTheme;
  privacy: TenantPrivacy;

  /** Populated once custom-domain support (plan phase 7) is built. */
  customDomain: string | null;
  customDomainVerified: boolean;
}

/** Serializable form, safe to send to the client (ids/dates as strings). */
export type TenantDTO = Omit<Tenant, '_id' | 'ownerId' | 'createdAt' | 'updatedAt'> & {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export function toTenantDTO(tenant: Tenant): TenantDTO {
  const { _id, ownerId, createdAt, updatedAt, ...rest } = tenant;
  return {
    ...rest,
    id: _id.toHexString(),
    ownerId: ownerId.toHexString(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'root', 'support', 'help',
  'blog', 'status', 'docs', 'assets', 'static', 'cdn', 'signup', 'login',
  'onboarding', 'billing', 'account',
]);

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function validateSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(normalized)) {
    return 'Slug must be 3-32 characters, lowercase letters/numbers/hyphens, no leading or trailing hyphen.';
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return 'This slug is reserved.';
  }
  return null;
}

async function collection() {
  const db = await getDb();
  return db.collection<Tenant>('tenants');
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const col = await collection();
  return col.findOne({ slug: slug.toLowerCase() });
}

export async function getTenantByCustomDomain(domain: string): Promise<Tenant | null> {
  const col = await collection();
  return col.findOne({ customDomain: domain.toLowerCase(), customDomainVerified: true });
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const col = await collection();
  return col.findOne({ _id: new ObjectId(id) });
}

export async function listTenantsByOwner(ownerId: ObjectId): Promise<Tenant[]> {
  const col = await collection();
  return col.find({ ownerId }).sort({ createdAt: -1 }).toArray();
}

export interface CreateTenantInput {
  slug: string;
  ownerId: ObjectId;
  babyName: string;
  sex?: BabySex;
  dueDate?: string | null;
  language?: TenantLanguageMode;
  theme?: Partial<TenantTheme>;
  privacy?: Partial<TenantPrivacy>;
}

export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const slug = input.slug.trim().toLowerCase();
  const slugError = validateSlug(slug);
  if (slugError) {
    throw new Error(slugError);
  }

  const col = await collection();
  const existing = await col.findOne({ slug });
  if (existing) {
    throw new Error('This slug is already taken.');
  }

  const now = new Date();
  const tenant: Tenant = {
    _id: new ObjectId(),
    slug,
    ownerId: input.ownerId,
    createdAt: now,
    updatedAt: now,

    babyName: input.babyName.trim(),
    sex: input.sex ?? 'unknown',
    dueDate: input.dueDate ?? null,
    birthDatetime: null,
    weight: null,
    lengthCm: null,
    birthMessage: '',
    birthMessageEn: '',
    milestones: [],

    language: input.language ?? 'en',
    theme: {
      palette: isPaletteId(input.theme?.palette) ? input.theme!.palette! : DEFAULT_PALETTE,
      font: isFontId(input.theme?.font) ? input.theme!.font! : DEFAULT_FONT,
    },
    privacy: {
      showName: input.privacy?.showName ?? true,
      showSex: input.privacy?.showSex ?? true,
    },

    customDomain: null,
    customDomainVerified: false,
  };

  await col.insertOne(tenant);
  return tenant;
}

/**
 * Fields an owner may change from the admin dashboard. Ownership must be
 * checked by the caller (compare `tenant.ownerId` to the authenticated user)
 * before calling this — it performs no authorization itself.
 */
export type TenantUpdate = Partial<
  Pick<
    Tenant,
    | 'babyName'
    | 'sex'
    | 'dueDate'
    | 'birthDatetime'
    | 'weight'
    | 'lengthCm'
    | 'birthMessage'
    | 'birthMessageEn'
    | 'milestones'
    | 'language'
    | 'theme'
    | 'privacy'
  >
>;

export async function updateTenant(id: ObjectId, patch: TenantUpdate): Promise<Tenant | null> {
  const col = await collection();
  const result = await col.findOneAndUpdate(
    { _id: id },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result ?? null;
}
