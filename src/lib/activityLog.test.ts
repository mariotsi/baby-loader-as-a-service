import { afterAll, assert, beforeAll, expect, test } from 'vitest';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { type ActivityWriter, errorList, logActivity, siteWriteActivity } from './activityLog.ts';
import { issueSessionToken } from './auth.ts';
import { type BirthWriteDeps, saveSettings, setBirth } from './birthChange.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite, settingsPath, siteSettingsOf } from './siteSettings.ts';

const NOW = new Date('2026-11-03T10:00:00Z');
const DEPS: BirthWriteDeps = {
  push: { send: async () => 'delivered' },
  media: () => {
    throw new Error('no media in these tests');
  },
  now: NOW,
};

let stopDb: () => Promise<void>;
let token: string;
let userId: string;

beforeAll(async () => {
  stopDb = await startTestDb();
  userId = await insertTestUser();
  token = issueSessionToken(userId);
});

afterAll(() => stopDb());

async function waitingSite(slug: string): Promise<OwnedSite> {
  const parsed = parseNewSite(
    { slug, settings: { ...defaultSiteSettings, babyName: 'Emma', sex: 'female', dueDate: '2026-11-20' } },
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

function recorder() {
  const lines: { level: string; line: unknown }[] = [];
  const writer: ActivityWriter = {
    log: (line) => lines.push({ level: 'log', line }),
    warn: (line) => lines.push({ level: 'warn', line }),
  };
  return { lines, writer };
}

test('an action that went through is one log line, and a refused one is a warning', () => {
  const { lines, writer } = recorder();
  logActivity('user.login', { ok: true, userId: 'u1' }, writer);
  logActivity('user.login', { ok: false, reason: 'wrongCredentials' }, writer);
  expect(lines).toStrictEqual([
    { level: 'log', line: { event: 'user.login', ok: true, userId: 'u1' } },
    { level: 'warn', line: { event: 'user.login', ok: false, reason: 'wrongCredentials' } },
  ]);
});

test('Site settings errors are listed by path and code', () => {
  expect(errorList([{ path: settingsPath('babyName'), code: 'tooLong', params: { max: 40 } }])).toStrictEqual([
    'babyName:tooLong',
  ]);
});

test('a save names the settings it changed, and none when it changed nothing', async () => {
  const owned = await waitingSite('activity-save');
  const { birth: _birth, ...settings } = siteSettingsOf(owned.site);
  const same = await saveSettings(owned, { updatedAt: owned.site.updatedAt, settings }, DEPS);
  expect(same.ok, JSON.stringify(same)).toBeTruthy();
  expect(siteWriteActivity(owned, same)).toStrictEqual({
    slug: 'activity-save',
    userId,
    ok: true,
    changed: [],
    changes: {},
    announced: false,
    notification: 'none',
    delivery: undefined,
  });

  const reloaded = await reload('activity-save');
  const renamed = await saveSettings(
    reloaded,
    { updatedAt: reloaded.site.updatedAt, settings: { ...settings, babyName: 'Sofia' } },
    DEPS
  );
  expect(renamed.ok, JSON.stringify(renamed)).toBeTruthy();
  const activity = siteWriteActivity(reloaded, renamed);
  expect(activity.changed).toStrictEqual(['babyName']);
  expect(activity.changes).toStrictEqual({ babyName: { from: 'Emma', to: 'Sofia' } });
});

test('a save lists the Milestones it added and removed, and an edited one as both', async () => {
  const owned = await waitingSite('activity-milestones');
  const { birth: _birth, ...settings } = siteSettingsOf(owned.site);
  const scan = { emoji: '🩺', label: { en: 'Scan' }, date: '2026-11-05' };
  const shower = { emoji: '🎁', label: { en: 'Shower' }, date: '2026-11-10' };
  const first = await saveSettings(
    owned,
    { updatedAt: owned.site.updatedAt, settings: { ...settings, milestones: [scan, shower] } },
    DEPS
  );
  assert(first.ok, JSON.stringify(first));
  expect(siteWriteActivity(owned, first).changes).toStrictEqual({
    milestones: { added: first.site.milestones, removed: [] },
  });

  const reloaded = await reload('activity-milestones');
  const second = await saveSettings(
    reloaded,
    { updatedAt: reloaded.site.updatedAt, settings: { ...settings, milestones: [scan, { ...shower, emoji: '🎉' }] } },
    DEPS
  );
  assert(second.ok, JSON.stringify(second));
  expect(siteWriteActivity(reloaded, second).changes).toStrictEqual({
    milestones: { added: [second.site.milestones[1]], removed: [reloaded.site.milestones[1]] },
  });
});

test('announcing says so, with how the Birth notification went', async () => {
  const owned = await waitingSite('activity-birth');
  const result = await setBirth(
    owned,
    {
      updatedAt: owned.site.updatedAt,
      babyName: 'Emma',
      sex: 'female',
      details: { datetime: '2026-11-02T08:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
      birthVideo: null,
    },
    DEPS
  );
  assert(result.ok, JSON.stringify(result));
  const activity = siteWriteActivity(owned, result);
  expect(activity.announced).toBe(true);
  expect(activity.notification).toBe('sent');
  expect(activity.delivery).toStrictEqual({ sent: 0, removed: 0, total: 0 });
  expect((activity.changes as Record<string, unknown>).birth).toStrictEqual({
    from: owned.site.birth,
    to: result.site.birth,
  });
});

test('a refused write gives its reason, and an invalid one its errors', async () => {
  const owned = await waitingSite('activity-refused');
  const { birth: _birth, ...settings } = siteSettingsOf(owned.site);
  const stale = await saveSettings(owned, { updatedAt: 'earlier', settings }, DEPS);
  expect(siteWriteActivity(owned, stale)).toStrictEqual({
    slug: 'activity-refused',
    userId,
    ok: false,
    reason: 'stale',
  });

  const invalid = await saveSettings(
    owned,
    { updatedAt: owned.site.updatedAt, settings: { ...settings, babyName: 7 } },
    DEPS
  );
  const activity = siteWriteActivity(owned, invalid);
  expect(activity.reason).toBe('invalid');
  expect(activity.errors).toStrictEqual(['babyName:invalidType']);
});
