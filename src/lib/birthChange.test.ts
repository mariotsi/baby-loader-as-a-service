import { afterAll, assert, beforeAll, expect, test } from 'vitest';
import { insertTestUser, startTestDb, testSubscription } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import { type BirthWriteDeps, clearBirth, saveSettings, setBirth } from './birthChange.ts';
import { memoryMediaStore, noCachePurge } from './mediaStore.ts';
import type { PushOutcome, PushService } from './notificationDelivery.ts';
import { listNotifications } from './notificationLog.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite, type Site } from './site.ts';
import { type MediaKey, siteMedia } from './siteMedia.ts';
import {
  type BirthMedia,
  defaultSiteSettings,
  parseNewSite,
  type SiteSettingsInput,
  siteSettingsOf,
} from './siteSettings.ts';
import { upsertSubscription } from './subscription.ts';

const NOW = new Date('2026-11-03T10:00:00Z');
/** 20:00 UTC on 25 October is already the 26th in Auckland. */
const BIRTH_AT = '2026-10-25T20:00:00.000Z';

let stopDb: () => Promise<void>;
let token: string;

beforeAll(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
});

afterAll(() => stopDb());

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
  assert(parsed.ok, JSON.stringify(parsed));
  assert((await createSite(authenticate(token) as AuthenticatedUser, parsed.value)).ok);
  return reload(slug);
}

async function reload(slug: string): Promise<OwnedSite> {
  const access = await accessOwnedSite(token, slug);
  assert(typeof access === 'object');
  return access;
}

/** Site media in memory, served from one host, recording what it is asked to delete. */
function fakeMedia(failDeletes = false) {
  const deleted: string[] = [];
  const { store } = memoryMediaStore();
  const recording = siteMedia({
    store: {
      ...store,
      delete(key) {
        if (failDeletes) {
          return Promise.reject(new Error('storage is down'));
        }
        deleted.push(key);
        return store.delete(key);
      },
    },
    purge: noCachePurge,
    publicUrl: 'https://media.test',
    log: () => {},
  });
  return { deleted, media: recording };
}

function media(owned: OwnedSite, name: string, type: BirthMedia['type'] = 'image/jpeg'): BirthMedia {
  const key = `customer-data/${owned.owner.id}/${owned.site.id}/${crypto.randomUUID()}` as MediaKey;
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
  return { push: fakePush().service, media: () => fakeMedia().media, now: NOW, ...overrides };
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
  assert(result.ok, JSON.stringify(result));
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
  expect(site.birth.born).toBe(true);
  expect(site.milestones.filter((m) => m.kind === 'birth').map((m) => m.date)).toStrictEqual(['2026-10-26']);
  assert(result.ok);
  expect(result.notification).toStrictEqual({ sent: 1, removed: 0, total: 1 });
  expect(push.sent.length).toBe(1);
  expect(push.sent[0].body).toBe('Welcome, Emma!');
  const [logged] = await listNotifications(owned.site.id);
  expect(logged.kind).toBe('birth');
});

test('announcing leaves the Privacy settings as the Owner chose them', async () => {
  const owned = await waitingSite('birth-privacy');
  const site = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  expect(site.privacy).toStrictEqual({ showName: false, showSex: false });
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
  assert(saved.ok, JSON.stringify(saved));
  const push = fakePush();

  const result = await setBirth(
    await reload('birth-edit'),
    birthBody(saved.site, {
      details: { datetime: '2026-10-24T09:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    }),
    deps({ push: push.service })
  );

  const site = okSite(result);
  assert(result.ok);
  expect(result.notification).toBe(null);
  expect(push.sent.length).toBe(0);
  expect(site.milestones.filter((m) => m.kind === 'birth')).toStrictEqual([
    { emoji: '👶', label: { it: 'Eccola', en: 'Here' }, date: '2026-10-24', kind: 'birth' },
  ]);
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
  const { media: recording, deleted } = fakeMedia();

  const result = await clearBirth(
    await reload('birth-undo'),
    { updatedAt: announced.updatedAt },
    deps({ media: () => recording })
  );

  const site = okSite(result);
  expect(site.birth).toStrictEqual({ born: false, details: null });
  expect(site.milestones.some((m) => m.kind === 'birth')).toBe(false);
  expect(site.privacy).toStrictEqual({ showName: false, showSex: false });
  expect(site.birthVideo).toStrictEqual(video);
  expect(deleted).toStrictEqual([photo.key]);
});

test('announcing again after going back sends the Birth notification again', async () => {
  const owned = await waitingSite('birth-again');
  await subscribe(owned, 'https://push.test/again');
  const first = okSite(await setBirth(owned, birthBody(owned.site), deps()));
  const back = okSite(await clearBirth(await reload('birth-again'), { updatedAt: first.updatedAt }, deps()));
  const push = fakePush();

  const result = await setBirth(await reload('birth-again'), birthBody(back), deps({ push: push.service }));

  okSite(result);
  expect(push.sent.length).toBe(1);
  expect((await listNotifications(owned.site.id)).map((n) => n.kind)).toStrictEqual(['birth', 'birth']);
});

test('a write from a tab that missed the last save is refused, and nothing changes or goes out', async () => {
  const owned = await waitingSite('birth-stale');
  await subscribe(owned, 'https://push.test/stale');
  const push = fakePush();
  const stale = { ...birthBody(owned.site), updatedAt: '2026-01-01T00:00:00.000Z' };

  expect(await setBirth(owned, stale, deps({ push: push.service }))).toStrictEqual({ ok: false, refused: 'stale' });
  expect(await clearBirth(owned, { updatedAt: stale.updatedAt }, deps())).toStrictEqual({
    ok: false,
    refused: 'stale',
  });
  const { birth: _, ...settings } = siteSettingsOf(owned.site);
  expect(await saveSettings(owned, { updatedAt: stale.updatedAt, settings }, deps())).toStrictEqual({
    ok: false,
    refused: 'stale',
  });

  expect((await reload('birth-stale')).site.birth.born).toBe(false);
  expect(push.sent.length).toBe(0);
  expect(await listNotifications(owned.site.id)).toStrictEqual([]);
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
  assert('errors' in result);
  expect(result.errors.map((e) => e.path).sort((a, b) => a.localeCompare(b))).toStrictEqual([
    'birth.details.weightGrams',
  ]);
  const later = await setBirth(
    owned,
    birthBody(owned.site, {
      babyName: '',
      details: { datetime: '2026-12-01T10:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    }),
    deps()
  );
  assert('errors' in later);
  expect(later.errors.map((e) => e.path).sort((a, b) => a.localeCompare(b))).toStrictEqual([
    'babyName',
    'birth.details.datetime',
  ]);
  expect((await reload('birth-invalid')).site.birth.born).toBe(false);
});

test('the Birth endpoint takes only the Birth’s own fields', async () => {
  const owned = await waitingSite('birth-fields');
  expect(await setBirth(owned, { ...birthBody(owned.site), privacy: { showName: true } }, deps())).toStrictEqual({
    ok: false,
    refused: 'invalidRequest',
  });
  expect(await setBirth(owned, { ...birthBody(owned.site), updatedAt: undefined }, deps())).toStrictEqual({
    ok: false,
    refused: 'invalidRequest',
  });
});

test('media outside the Site’s own folder is refused', async () => {
  const owned = await waitingSite('birth-foreign-media');
  const foreign = {
    ...media(owned, 'video.mp4', 'video/mp4'),
    key: `customer-data/someone/else/${crypto.randomUUID()}` as MediaKey,
  };
  foreign.url = `https://media.test/${foreign.key}`;
  expect(await setBirth(owned, birthBody(owned.site, { birthVideo: foreign }), deps())).toStrictEqual({
    ok: false,
    refused: 'invalidRequest',
  });
});

test('announcing with push not configured still saves, and says the notification failed', async () => {
  const owned = await waitingSite('birth-no-push');
  const result = await setBirth(owned, birthBody(owned.site), deps({ push: null }));
  okSite(result);
  assert(result.ok);
  expect(result.notification).toBe('failed');
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
  expect(refused).toStrictEqual({ ok: false, errors: [{ path: 'birth', code: 'unknownField' }] });

  const saved = await saveSettings(
    await reload('settings-birth'),
    { updatedAt: announced.updatedAt, settings: { ...settings, babyName: 'Emma Rose' } },
    deps()
  );
  assert(saved.ok, JSON.stringify(saved));
  expect(saved.site.babyName).toBe('Emma Rose');
  expect(saved.site.birth).toStrictEqual(birth);
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
  assert(kept.ok, JSON.stringify(kept));
  // 20:00 UTC is 21:00 in Rome, still the 25th.
  expect(kept.site.milestones.filter((m) => m.kind === 'birth').map((m) => m.date)).toStrictEqual(['2026-10-25']);

  const removed = await saveSettings(
    await reload('settings-milestone'),
    { updatedAt: kept.site.updatedAt, settings: { ...settings, milestones: [] } },
    deps()
  );
  assert(removed.ok, JSON.stringify(removed));
  expect(removed.site.milestones).toStrictEqual([]);
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
  assert(withFirst.ok, JSON.stringify(withFirst));
  const { media: recording, deleted } = fakeMedia();

  const withSecond = await saveSettings(
    await reload('settings-media'),
    { updatedAt: withFirst.site.updatedAt, settings: { ...settings, birthVideo: second } },
    deps({ media: () => recording })
  );
  assert(withSecond.ok, JSON.stringify(withSecond));
  expect(deleted).toStrictEqual([first.key]);

  const failing = fakeMedia(true);
  const cleared = await saveSettings(
    await reload('settings-media'),
    { updatedAt: withSecond.site.updatedAt, settings: { ...settings, birthVideo: null } },
    deps({ media: () => failing.media })
  );
  assert(cleared.ok, JSON.stringify(cleared));
  expect(cleared.site.birthVideo).toBe(null);
});
