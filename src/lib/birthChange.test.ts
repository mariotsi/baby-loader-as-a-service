import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { insertTestUser, startTestDb, testSubscription } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import { type BirthWriteDeps, clearBirth, saveSettings, setBirth } from './birthChange.ts';
import type { PushOutcome, PushService } from './notificationDelivery.ts';
import { listNotifications } from './notificationLog.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite, type Site } from './site.ts';
import {
  type BirthMedia,
  defaultSiteSettings,
  parseNewSite,
  type SiteSettingsInput,
  siteSettingsOf,
} from './siteSettings.ts';
import { customerMediaPrefix } from './storage.ts';
import { upsertSubscription } from './subscription.ts';

const NOW = new Date('2026-11-03T10:00:00Z');
/** 20:00 UTC on 25 October is already the 26th in Auckland. */
const BIRTH_AT = '2026-10-25T20:00:00.000Z';

let stopDb: () => Promise<void>;
let token: string;

before(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
});

after(() => stopDb());

async function waitingSite(slug: string, settings: Partial<SiteSettingsInput> = {}): Promise<OwnedSite> {
  const parsed = parseNewSite(
    {
      slug,
      settings: {
        ...defaultSiteSettings,
        babyName: 'Emma',
        sex: 'female',
        dueDate: '2026-11-20',
        timezone: 'Pacific/Auckland',
        languages: ['it', 'en'],
        privacy: { showName: false, showSex: false },
        ...settings,
      },
    },
    NOW
  );
  assert.ok(parsed.ok, JSON.stringify(parsed));
  assert.ok((await createSite(authenticate(token) as AuthenticatedUser, parsed.value)).ok);
  return reload(slug);
}

async function reload(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(token, slug);
  assert.ok(typeof access === 'object');
  return access;
}

/** A storage that serves every key from one host and records what it is asked to delete. */
function fakeStorage(failDeletes = false) {
  const deleted: string[] = [];
  return {
    deleted,
    storage: {
      publicUrl: (key: string) => `https://media.test/${key}`,
      delete(_site: OwnedSite, key: string) {
        if (failDeletes) {
          return Promise.reject(new Error('storage is down'));
        }
        deleted.push(key);
        return Promise.resolve();
      },
    },
  };
}

function media(owned: OwnedSite, name: string, type: BirthMedia['type'] = 'image/jpeg'): BirthMedia {
  const key = `${customerMediaPrefix(owned)}${name}`;
  return { key, url: `https://media.test/${key}`, name, type, size: 1000 };
}

function fakePush(outcome: PushOutcome = 'delivered') {
  const sent: Record<string, unknown>[] = [];
  const service: PushService = {
    send(_target, payload) {
      sent.push(JSON.parse(payload));
      return Promise.resolve(outcome);
    },
  };
  return { service, sent };
}

function deps(overrides: Partial<BirthWriteDeps> = {}): BirthWriteDeps {
  return { push: fakePush().service, storage: () => fakeStorage().storage, now: NOW, ...overrides };
}

function birthBody(site: Site, overrides: Record<string, unknown> = {}) {
  return {
    updatedAt: site.updatedAt,
    babyName: 'Emma',
    sex: 'female',
    details: { datetime: BIRTH_AT, weightGrams: 3200, lengthCm: 50, message: { en: 'Welcome, Emma!' } },
    birthVideo: site.birthVideo,
    ...overrides,
  };
}

function okSite(result: Awaited<ReturnType<typeof setBirth>>): Site {
  assert.ok(result.ok, JSON.stringify(result));
  return result.site;
}

async function subscribe(owned: OwnedSite, endpoint: string) {
  await upsertSubscription({
    siteId: owned.site.id,
    subscription: testSubscription(endpoint),
    lang: 'en',
    deviceInfo: null,
    geo: null,
  });
}

test('announcing saves the Birth, adds the Birth milestone on its day in the Site’s Timezone, and sends the Birth notification', async () => {
  const owned = await waitingSite('birth-announce');
  await subscribe(owned, 'https://push.test/announce');
  const push = fakePush();

  const result = await setBirth(owned, birthBody(owned.site), deps({ push: push.service }));

  const site = okSite(result);
  assert.equal(site.birth.born, true);
  assert.deepEqual(
    site.milestones.filter((m) => m.kind === 'birth').map((m) => m.date),
    ['2026-10-26']
  );
  assert.ok(result.ok);
  assert.deepEqual(result.notification, { sent: 1, removed: 0, total: 1 });
  assert.equal(push.sent.length, 1);
  assert.equal(push.sent[0].body, 'Welcome, Emma!');
  const [logged] = await listNotifications(owned.site.id);
  assert.equal(logged.kind, 'birth');
});

test('announcing leaves the Privacy settings as the Owner chose them', async () => {
  const owned = await waitingSite('birth-privacy');
  const site = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  assert.deepEqual(site.privacy, { showName: false, showSex: false });
});

test('changing the Birth once Born sends nothing and moves the Birth milestone, keeping its label', async () => {
  const owned = await waitingSite('birth-edit');
  const announced = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  const relabelled = {
    ...siteSettingsOf(announced),
    milestones: announced.milestones.map((m) =>
      m.kind === 'birth' ? { ...m, label: { it: 'Eccola', en: 'Here' } } : m
    ),
  };
  const { birth: _, ...settings } = relabelled;
  const saved = await saveSettings(await reload('birth-edit'), { updatedAt: announced.updatedAt, settings }, deps());
  assert.ok(saved.ok, JSON.stringify(saved));
  const push = fakePush();

  const result = await setBirth(
    await reload('birth-edit'),
    birthBody(saved.site, {
      details: { datetime: '2026-10-24T09:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    }),
    deps({ push: push.service })
  );

  const site = okSite(result);
  assert.ok(result.ok);
  assert.equal(result.notification, null);
  assert.equal(push.sent.length, 0);
  assert.deepEqual(
    site.milestones.filter((m) => m.kind === 'birth'),
    [{ emoji: '👶', label: { it: 'Eccola', en: 'Here' }, date: '2026-10-24', kind: 'birth' }]
  );
});

test('going back to the Countdown drops the Birth details, the Birth milestone and the photo, and keeps the Birth video', async () => {
  const owned = await waitingSite('birth-undo');
  const video = media(owned, 'video.mp4', 'video/mp4');
  const photo = media(owned, 'photo.jpg');
  const announced = okSite(
    await setBirth(
      owned,
      birthBody(owned.site, {
        details: { datetime: BIRTH_AT, weightGrams: null, lengthCm: null, message: {}, photo },
        birthVideo: video,
      }),
      deps()
    )
  );
  const { storage, deleted } = fakeStorage();

  const result = await clearBirth(
    await reload('birth-undo'),
    { updatedAt: announced.updatedAt },
    deps({ storage: () => storage })
  );

  const site = okSite(result);
  assert.deepEqual(site.birth, { born: false, details: null });
  assert.equal(
    site.milestones.some((m) => m.kind === 'birth'),
    false
  );
  assert.deepEqual(site.privacy, { showName: false, showSex: false });
  assert.deepEqual(site.birthVideo, video);
  assert.deepEqual(deleted, [photo.key]);
});

test('announcing again after going back sends the Birth notification again', async () => {
  const owned = await waitingSite('birth-again');
  await subscribe(owned, 'https://push.test/again');
  const first = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  const back = okSite(await clearBirth(await reload('birth-again'), { updatedAt: first.updatedAt }, deps()));
  const push = fakePush();

  const result = await setBirth(await reload('birth-again'), birthBody(back), deps({ push: push.service }));

  okSite(result);
  assert.equal(push.sent.length, 1);
  assert.deepEqual(
    (await listNotifications(owned.site.id)).map((n) => n.kind),
    ['birth', 'birth']
  );
});

test('a write from a tab that missed the last save is refused, and nothing changes or goes out', async () => {
  const owned = await waitingSite('birth-stale');
  await subscribe(owned, 'https://push.test/stale');
  const push = fakePush();
  const stale = { ...birthBody(owned.site), updatedAt: '2026-01-01T00:00:00.000Z' };

  assert.deepEqual(await setBirth(owned, stale, deps({ push: push.service })), { ok: false, refused: 'stale' });
  assert.deepEqual(await clearBirth(owned, { updatedAt: stale.updatedAt }, deps()), { ok: false, refused: 'stale' });
  const { birth: _, ...settings } = siteSettingsOf(owned.site);
  assert.deepEqual(await saveSettings(owned, { updatedAt: stale.updatedAt, settings }, deps()), {
    ok: false,
    refused: 'stale',
  });

  assert.equal((await reload('birth-stale')).site.birth.born, false);
  assert.equal(push.sent.length, 0);
  assert.deepEqual(await listNotifications(owned.site.id), []);
});

test('an invalid Birth names its fields as Site settings do, and nothing is saved', async () => {
  const owned = await waitingSite('birth-invalid');
  const result = await setBirth(
    owned,
    birthBody(owned.site, {
      babyName: '',
      details: { datetime: '2026-12-01T10:00:00.000Z', weightGrams: 3200.5, lengthCm: null, message: {} },
    }),
    deps()
  );
  assert.ok('errors' in result);
  assert.deepEqual(
    result.errors.map((e) => e.path).sort((a, b) => a.localeCompare(b)),
    ['birth.details.weightGrams']
  );
  const later = await setBirth(
    owned,
    birthBody(owned.site, {
      babyName: '',
      details: { datetime: '2026-12-01T10:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    }),
    deps()
  );
  assert.ok('errors' in later);
  assert.deepEqual(
    later.errors.map((e) => e.path).sort((a, b) => a.localeCompare(b)),
    ['babyName', 'birth.details.datetime']
  );
  assert.equal((await reload('birth-invalid')).site.birth.born, false);
});

test('the Birth endpoint takes only the Birth’s own fields', async () => {
  const owned = await waitingSite('birth-fields');
  assert.deepEqual(await setBirth(owned, { ...birthBody(owned.site), privacy: { showName: true } }, deps()), {
    ok: false,
    refused: 'invalidRequest',
  });
  assert.deepEqual(await setBirth(owned, { ...birthBody(owned.site), updatedAt: undefined }, deps()), {
    ok: false,
    refused: 'invalidRequest',
  });
});

test('media outside the Site’s own folder is refused', async () => {
  const owned = await waitingSite('birth-foreign-media');
  const foreign = { ...media(owned, 'video.mp4', 'video/mp4'), key: 'customer-data/someone/else/video.mp4' };
  foreign.url = `https://media.test/${foreign.key}`;
  assert.deepEqual(await setBirth(owned, birthBody(owned.site, { birthVideo: foreign }), deps()), {
    ok: false,
    refused: 'invalidRequest',
  });
});

test('announcing with push not configured still saves, and says the notification failed', async () => {
  const owned = await waitingSite('birth-no-push');
  const result = await setBirth(owned, birthBody(owned.site), deps({ push: null }));
  okSite(result);
  assert.ok(result.ok);
  assert.equal(result.notification, 'failed');
});

test('saving the Site settings keeps the stored Birth and refuses one sent with them', async () => {
  const owned = await waitingSite('settings-birth');
  const announced = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  const { birth, ...settings } = siteSettingsOf(announced);

  const refused = await saveSettings(
    await reload('settings-birth'),
    { updatedAt: announced.updatedAt, settings: { ...settings, birth: { born: false, details: null } } },
    deps()
  );
  assert.deepEqual(refused, { ok: false, errors: [{ path: 'birth', code: 'unknownField' }] });

  const saved = await saveSettings(
    await reload('settings-birth'),
    { updatedAt: announced.updatedAt, settings: { ...settings, babyName: 'Emma Rose' } },
    deps()
  );
  assert.ok(saved.ok, JSON.stringify(saved));
  assert.equal(saved.site.babyName, 'Emma Rose');
  assert.deepEqual(saved.site.birth, birth);
});

test('the Birth milestone’s date follows the Birth whatever the Site settings send, and a removed one stays removed', async () => {
  const owned = await waitingSite('settings-milestone');
  const announced = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  const { birth: _, ...settings } = siteSettingsOf(announced);
  const moved = settings.milestones.map((m) => (m.kind === 'birth' ? { ...m, date: '2026-01-01' } : m));

  const kept = await saveSettings(
    await reload('settings-milestone'),
    { updatedAt: announced.updatedAt, settings: { ...settings, milestones: moved, timezone: 'Europe/Rome' } },
    deps()
  );
  assert.ok(kept.ok, JSON.stringify(kept));
  // 20:00 UTC is 21:00 in Rome, still the 25th.
  assert.deepEqual(
    kept.site.milestones.filter((m) => m.kind === 'birth').map((m) => m.date),
    ['2026-10-25']
  );

  const removed = await saveSettings(
    await reload('settings-milestone'),
    { updatedAt: kept.site.updatedAt, settings: { ...settings, milestones: [] } },
    deps()
  );
  assert.ok(removed.ok, JSON.stringify(removed));
  assert.deepEqual(removed.site.milestones, []);
});

test('the media a save replaces leaves storage, and a failed removal does not fail the save', async () => {
  const owned = await waitingSite('settings-media');
  const first = media(owned, 'first.mp4', 'video/mp4');
  const second = media(owned, 'second.mp4', 'video/mp4');
  const { birth: _, ...settings } = siteSettingsOf(owned.site);
  const withFirst = await saveSettings(
    owned,
    { updatedAt: owned.site.updatedAt, settings: { ...settings, birthVideo: first } },
    deps()
  );
  assert.ok(withFirst.ok, JSON.stringify(withFirst));
  const { storage, deleted } = fakeStorage();

  const withSecond = await saveSettings(
    await reload('settings-media'),
    { updatedAt: withFirst.site.updatedAt, settings: { ...settings, birthVideo: second } },
    deps({ storage: () => storage })
  );
  assert.ok(withSecond.ok, JSON.stringify(withSecond));
  assert.deepEqual(deleted, [first.key]);

  const failing = fakeStorage(true);
  const cleared = await saveSettings(
    await reload('settings-media'),
    { updatedAt: withSecond.site.updatedAt, settings: { ...settings, birthVideo: null } },
    deps({ storage: () => failing.storage })
  );
  assert.ok(cleared.ok, JSON.stringify(cleared));
  assert.equal(cleared.site.birthVideo, null);
});
