import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { sites } from '../db/schema.ts';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
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

before(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
  owner = authenticate(token) as AuthenticatedUser;
});

after(() => stopDb());

function newSite(slug: string, settings: SiteSettingsInput = defaultSiteSettings) {
  const parsed = parseNewSite({
    slug,
    settings: {
      ...settings,
      dueDate: settings.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    },
  });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  return parsed.value;
}

async function owned(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(token, slug);
  assert.ok(typeof access === 'object');
  return access;
}

test('createSite stores the Site settings under the Owner', async () => {
  const created = await createSite(owner, newSite('noah', { ...defaultSiteSettings, babyName: 'Noah' }));
  assert.ok(created.ok);
  const stored = await getSiteBySlug('noah');
  assert.equal(stored?.babyName, 'Noah');
  assert.deepEqual(stored?.birth, { born: false, details: null });
  assert.equal(stored?.ownerId, owner.id);
  assert.deepEqual(
    (await listSitesByOwner(owner)).map((site) => site.slug),
    ['noah']
  );
});

test('a taken Slug is a slugTaken error from the unique index', async () => {
  assert.ok((await createSite(owner, newSite('mia'))).ok);
  assert.deepEqual(await createSite(owner, newSite('mia')), {
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
  assert.ok(withMilestone.ok);
  assert.ok((await createSite(owner, newSite('leo'))).ok);
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
  assert.ok(bornNoMilestones.ok);
  const saved = await saveSiteSettings(await owned('leo'), bornNoMilestones.value);

  assert.deepEqual(saved?.milestones, []);
  assert.equal(saved?.birth.born, true);
  assert.equal(saved?.slug, 'leo');
});

test('a Site saved with the Birth video in its Birth details reads it as the Birth video', async () => {
  assert.ok((await createSite(owner, newSite('ada'))).ok);
  const video = { key: 'customer-data/owner/site/video', url: 'https://media.example.com/video' };
  const details = { datetime: '2026-10-01T10:00:00.000Z', weightGrams: null, lengthCm: null, message: {} };
  const { birthVideo: _, ...legacy } = {
    ...defaultSiteSettings,
    birth: { born: true, details: { ...details, video } },
  };
  await getDb()
    .update(sites)
    .set({ settings: legacy as unknown as SiteSettings })
    .where(eq(sites.slug, 'ada'));

  const stored = await getSiteBySlug('ada');
  assert.deepEqual(stored?.birth, { born: true, details });
  assert.deepEqual(stored?.birthVideo, video);
  assert.equal((await getSiteBySlug('noah'))?.birthVideo, null);
});
