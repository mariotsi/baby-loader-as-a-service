import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { startTestDb } from './testDb.ts';
import { issueSessionToken } from './auth.ts';
import { accessOwnedSite, authenticate, type AuthenticatedUser, type OwnedSite } from './ownerAccess.ts';
import { createSite, getTenantBySlug, listTenantsByOwner, saveSiteSettings } from './tenant.ts';
import { defaultSiteSettings, parseNewSite, parseSiteSettings, type SiteSettingsInput } from './siteSettings.ts';

let stopDb: () => Promise<void>;
let token: string;
let owner: AuthenticatedUser;

before(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(new ObjectId().toHexString());
  owner = authenticate(token) as AuthenticatedUser;
});

after(() => stopDb());

function newSite(slug: string, settings: SiteSettingsInput = defaultSiteSettings) {
  const parsed = parseNewSite({ slug, settings });
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
  const stored = await getTenantBySlug('noah');
  assert.equal(stored?.babyName, 'Noah');
  assert.deepEqual(stored?.birth, { born: false, details: null });
  assert.ok(stored?.ownerId.equals(owner.id));
  assert.deepEqual(
    (await listTenantsByOwner(owner)).map((site) => site.slug),
    ['noah']
  );
});

test('a taken Slug is a slugTaken error from the unique index', async () => {
  assert.ok((await createSite(owner, newSite('mia'))).ok);
  assert.deepEqual(await createSite(owner, newSite('mia')), { ok: false, errors: [{ path: 'slug', code: 'slugTaken' }] });
});

test('saveSiteSettings replaces every Site setting at once', async () => {
  const withMilestone = parseSiteSettings({
    ...defaultSiteSettings,
    babyName: 'Leo',
    milestones: [{ label: 'First scan', date: '2026-05-01' }],
  });
  assert.ok(withMilestone.ok);
  assert.ok((await createSite(owner, newSite('leo'))).ok);
  await saveSiteSettings(await owned('leo'), withMilestone.value);

  const bornNoMilestones = parseSiteSettings({
    ...defaultSiteSettings,
    babyName: 'Leo',
    sex: 'male',
    birth: { born: true, details: { datetime: '2026-10-01T10:00:00.000Z', weightGrams: 3300, lengthCm: 51, message: { en: 'Hi' } } },
  });
  assert.ok(bornNoMilestones.ok);
  const saved = await saveSiteSettings(await owned('leo'), bornNoMilestones.value);

  assert.deepEqual(saved?.milestones, []);
  assert.equal(saved?.birth.born, true);
  assert.equal(saved?.slug, 'leo');
});
