import { eq } from 'drizzle-orm';
import { afterAll, assert, beforeAll, expect, test } from 'vitest';
import { getDb } from '../db/index.ts';
import { sites } from '../db/schema.ts';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { slugSchema } from './address.ts';
import { issueSessionToken } from './auth.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite, getSiteBySlug, listSitesByOwner, saveSiteSettings } from './site.ts';
import {
  defaultSiteSettings,
  parseNewSite,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsInput,
} from './siteSettings.ts';

let stopDb: () => Promise<void>;
let token: string;
let owner: AuthenticatedUser;

beforeAll(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
  owner = authenticate(token) as AuthenticatedUser;
});

afterAll(() => stopDb());

function newSite(slug: string, settings: SiteSettingsInput = defaultSiteSettings) {
  const parsed = parseNewSite({
    slug,
    settings: {
      ...settings,
      dueDate: settings.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  });
  assert(parsed.ok, JSON.stringify(parsed));
  return parsed.value;
}

async function owned(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(token, slug);
  assert(typeof access === 'object');
  return access;
}

test('createSite stores the Site settings under the Owner', async () => {
  const created = await createSite(owner, newSite('noah', { ...defaultSiteSettings, babyName: 'Noah' }));
  expect(created.ok).toBeTruthy();
  const stored = await getSiteBySlug('noah');
  expect(stored?.babyName).toBe('Noah');
  expect(stored?.birth).toStrictEqual({ born: false, details: null });
  expect(stored?.ownerId).toBe(owner.id);
  expect((await listSitesByOwner(owner)).map((site) => site.slug)).toStrictEqual(['noah']);
});

test('a taken Slug is a slugTaken error from the unique index', async () => {
  expect((await createSite(owner, newSite('mia'))).ok).toBeTruthy();
  expect(await createSite(owner, newSite('mia'))).toStrictEqual({
    ok: false,
    errors: [{ path: 'slug', code: 'slugTaken' }],
  });
});

test('saveSiteSettings replaces every Site setting at once', async () => {
  const withMilestone = parseSiteSettings({
    ...defaultSiteSettings,
    babyName: 'Leo',
    milestones: [{ emoji: '🩺', label: { en: 'First scan' }, date: '2026-05-01' }],
  });
  assert(withMilestone.ok);
  assert((await createSite(owner, newSite('leo'))).ok);
  await saveSiteSettings(await owned('leo'), withMilestone.value);

  const bornNoMilestones = parseSiteSettings({
    ...defaultSiteSettings,
    babyName: 'Leo',
    sex: 'male',
    birth: {
      born: true,
      details: { datetime: '2026-10-01T10:00:00.000Z', weightGrams: 3300, lengthCm: 51, message: { en: 'Hi' } },
    },
  });
  assert(bornNoMilestones.ok);
  const saved = await saveSiteSettings(await owned('leo'), bornNoMilestones.value);

  expect(saved?.milestones).toStrictEqual([]);
  expect(saved?.birth.born).toBe(true);
  expect(saved?.slug).toBe('leo');
});

test('a Site saved with the Birth video in its Birth details reads it as the Birth video', async () => {
  expect((await createSite(owner, newSite('ada'))).ok).toBeTruthy();
  const video = {
    key: 'customer-data/owner/site/1c0a4d2f-3b5e-4d6f-9071-829304a5b6c7',
    url: 'https://media.example.com/video',
  };
  const details = { datetime: '2026-10-01T10:00:00.000Z', weightGrams: null, lengthCm: null, message: {} };
  const { birthVideo: _, ...legacy } = {
    ...defaultSiteSettings,
    birth: { born: true, details: { ...details, video } },
  };
  await getDb()
    .update(sites)
    .set({ settings: legacy as unknown as SiteSettings })
    .where(eq(sites.slug, slugSchema.parse('ada')));

  const stored = await getSiteBySlug('ada');
  expect(stored?.birth).toStrictEqual({ born: true, details });
  expect(stored?.birthVideo).toStrictEqual(video);
  expect((await getSiteBySlug('noah'))?.birthVideo).toBe(null);
});
