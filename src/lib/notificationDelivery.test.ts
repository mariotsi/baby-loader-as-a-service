import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { insertTestUser, startTestDb, testSubscription } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import type { DeviceInfo } from './deviceInfo.ts';
import type { Lang } from './i18n.ts';
import { notificationContent } from './notificationContent.ts';
import {
  deliverNotification,
  deliverySummary,
  finishNotification,
  type PushOutcome,
  type PushService,
  type PushTarget,
  parseNotification,
  siteNotificationIcon,
  unfinishedBirth,
} from './notificationDelivery.ts';
import { listNotifications } from './notificationLog.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite, saveSiteSettings } from './site.ts';
import { defaultSiteSettings, parseNewSite, parseSiteSettings, type SiteSettingsInput } from './siteSettings.ts';
import {
  countSubscriptionsBySite,
  deleteSubscription,
  pushEndpointSchema,
  upsertSubscription,
} from './subscription.ts';

let stopDb: () => Promise<void>;
let token: string;

before(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
});

after(() => stopDb());

async function ownedSite(slug: string, settings: Partial<SiteSettingsInput> = {}): Promise<OwnedSite> {
  const full = { ...defaultSiteSettings, babyName: 'Emma', ...settings };
  // A Site is created Waiting and announced afterwards.
  const dueDate = full.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const parsed = parseNewSite({ slug, settings: { ...full, dueDate, birth: defaultSiteSettings.birth } });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  assert.ok((await createSite(authenticate(token) as AuthenticatedUser, parsed.value)).ok);
  const access = await accessOwnedSite(token, slug);
  assert.ok(typeof access === 'object');
  if (!full.birth.born) {
    return access;
  }
  const announced = parseSiteSettings(full);
  assert.ok(announced.ok, JSON.stringify(announced));
  await saveSiteSettings(access, announced.value);
  const updated = await accessOwnedSite(token, slug);
  assert.ok(typeof updated === 'object');
  return updated;
}

async function subscribe(owned: OwnedSite, endpoint: string, lang: Lang | null = null, device?: string) {
  await upsertSubscription({
    siteId: owned.site.id,
    subscription: testSubscription(endpoint),
    lang,
    deviceInfo: device ? ({ label: device } as DeviceInfo) : null,
    geo: null,
  });
}

/** A push service that records what it is asked to send and answers per endpoint. */
function fakePush(outcomes: Record<string, PushOutcome> = {}, delayMs = 0) {
  const sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const service: PushService = {
    async send(target: PushTarget, payload: string) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      inFlight -= 1;
      sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) });
      return outcomes[target.endpoint] ?? 'delivered';
    },
  };
  return { service, sent, maxInFlight: () => maxInFlight };
}

function valid(messages: unknown, langs: Lang[] = ['en']) {
  const parsed = parseNotification(messages, langs);
  assert.ok(parsed.ok, JSON.stringify(parsed));
  return parsed.value;
}

test("parseNotification needs a body per language sent, among the Site's languages", () => {
  assert.deepEqual(parseNotification(undefined, ['en']), {
    ok: false,
    errors: [{ path: 'messages', code: 'required' }],
  });
  assert.deepEqual(parseNotification({}, ['en']), { ok: false, errors: [{ path: 'messages', code: 'required' }] });
  assert.deepEqual(parseNotification({ en: { title: 'Hi', body: '  ' } }, ['en']), {
    ok: false,
    errors: [{ path: 'messages.en.body', code: 'required' }],
  });
  assert.deepEqual(parseNotification({ it: { body: 'Ciao' } }, ['en']), {
    ok: false,
    errors: [{ path: 'messages.it', code: 'invalidOption' }],
  });
  assert.deepEqual(parseNotification({ en: { body: 'Hi', url: 'https://evil.example' } }, ['en']), {
    ok: false,
    errors: [{ path: 'messages.en.url', code: 'unknownField' }],
  });
  assert.deepEqual(parseNotification({ en: { title: 'x'.repeat(101), body: 'x'.repeat(1001) } }, ['en']), {
    ok: false,
    errors: [
      { path: 'messages.en.body', code: 'tooLong', params: { max: 1000 } },
      { path: 'messages.en.title', code: 'tooLong', params: { max: 100 } },
    ],
  });
  assert.deepEqual(valid({ en: { title: '  ', body: ' Any day now ' } }).messages, { en: { body: 'Any day now' } });
});

test("each Subscription gets its language, else the Site's fallback one", async () => {
  const owned = await ownedSite('lang-site', { languages: ['it', 'en'] });
  await subscribe(owned, 'https://push.test/it', 'it');
  await subscribe(owned, 'https://push.test/en', 'en');
  await subscribe(owned, 'https://push.test/old');
  const push = fakePush();

  const result = await deliverNotification(
    owned,
    valid({ it: { body: 'Ciao' }, en: { body: 'Hi' } }, ['it', 'en']),
    push.service
  );

  assert.deepEqual(result, { sent: 3, removed: 0, total: 3 });
  const bodies = Object.fromEntries(push.sent.map((s) => [s.endpoint, s.payload.body]));
  assert.deepEqual(bodies, {
    'https://push.test/it': 'Ciao',
    'https://push.test/en': 'Hi',
    'https://push.test/old': 'Hi',
  });

  // Only one language written: everyone gets it.
  const onlyItalian = fakePush();
  await deliverNotification(owned, valid({ it: { body: 'Solo' } }, ['it', 'en']), onlyItalian.service);
  assert.ok(onlyItalian.sent.every((s) => s.payload.body === 'Solo'));
});

test("the payload opens the Site's Address, with its tag, a default title and its buttons' labels", async () => {
  const owned = await ownedSite('payload-site');
  await subscribe(owned, 'https://push.test/payload');
  const push = fakePush();

  await deliverNotification(owned, valid({ en: { body: 'Hi' } }), push.service);

  assert.deepEqual(push.sent[0].payload, {
    title: 'Emma',
    body: 'Hi',
    icon: '/icon-192.png',
    url: '/',
    tag: 'site-payload-site',
    actions: { open: 'Open', dismiss: 'Dismiss' },
  });
});

test('the payload is the content the previews show, in the Subscription’s Language', async () => {
  const owned = await ownedSite('preview-site', {
    languages: ['it', 'en'],
    privacy: { showName: false, showSex: true },
    pageName: { it: 'Casa Rossi' },
  });
  await subscribe(owned, 'https://push.test/preview-it', 'it');
  await subscribe(owned, 'https://push.test/preview-en', 'en');
  const push = fakePush();
  const messages = { it: { body: 'Ciao' }, en: { title: 'News', body: 'Hi' } };

  await deliverNotification(owned, valid(messages, ['it', 'en']), push.service);

  const icon = siteNotificationIcon(owned.site, '/');
  for (const lang of ['it', 'en'] as const) {
    const { payload } = push.sent.find((s) => s.endpoint === `https://push.test/preview-${lang}`) ?? {};
    const { title, body, actions } = notificationContent(owned.site, messages, lang, icon);
    assert.deepEqual(payload, { title, body, icon, url: '/', tag: 'site-preview-site', actions });
  }
});

test('the icon is the birth photo once born, else the Site icon', async () => {
  const emoji = await ownedSite('icon-emoji', { icon: '🐣' });
  await subscribe(emoji, 'https://push.test/icon-emoji');
  const emojiPush = fakePush();
  await deliverNotification(emoji, valid({ en: { body: 'Hi' } }), emojiPush.service);
  assert.match(String(emojiPush.sent[0].payload.icon), /^\/site-icon\/192\?v=1f423\./);

  const photo = { key: 'customer-data/o/s/photo', url: 'https://media.test/customer-data/o/s/photo' };
  const born = await ownedSite('icon-born', {
    icon: '🐣',
    sex: 'female',
    birth: {
      born: true,
      details: { datetime: '2026-01-15T08:30:00.000Z', weightGrams: null, lengthCm: null, message: {}, photo },
    },
  });
  await subscribe(born, 'https://push.test/icon-born');
  const bornPush = fakePush();
  await deliverNotification(born, valid({ en: { body: 'Hi' } }), bornPush.service);
  assert.equal(bornPush.sent[0].payload.icon, photo.url);
});

test('the Site’s name is the title while Privacy settings hide the baby’s', async () => {
  const owned = await ownedSite('hidden-site', { privacy: { showName: false, showSex: true } });
  await subscribe(owned, 'https://push.test/hidden');
  const push = fakePush();

  await deliverNotification(owned, valid({ en: { body: 'Hi' } }), push.service);

  assert.equal(push.sent[0].payload.title, 'Loading Baby');
});

test('a gone endpoint is forgotten on every Site, a failed one is kept', async () => {
  const site = await ownedSite('prune-site');
  const other = await ownedSite('prune-other');
  await subscribe(site, 'https://push.test/gone');
  await subscribe(other, 'https://push.test/gone');
  await subscribe(site, 'https://push.test/failed');
  await subscribe(site, 'https://push.test/fine');
  const push = fakePush({ 'https://push.test/gone': 'gone', 'https://push.test/failed': 'failed' });

  const result = await deliverNotification(site, valid({ en: { body: 'Hi' } }), push.service);

  assert.deepEqual(result, { sent: 1, removed: 1, total: 3 });
  assert.equal(await countSubscriptionsBySite(site.site.id), 2);
  assert.equal(await countSubscriptionsBySite(other.site.id), 0);
});

test('sends at most 20 at a time', async () => {
  const owned = await ownedSite('batch-site');
  for (let i = 0; i < 45; i += 1) {
    await subscribe(owned, `https://push.test/batch/${i}`);
  }
  const push = fakePush({}, 5);

  const result = await deliverNotification(owned, valid({ en: { body: 'Hi' } }), push.service);

  assert.deepEqual(result, { sent: 45, removed: 0, total: 45 });
  assert.equal(push.maxInFlight(), 20);
});

test('a sent Notification is logged with a Delivery per Subscription', async () => {
  const owned = await ownedSite('log-site');
  await subscribe(owned, 'https://push.test/log/fine', null, 'iPhone, Safari');
  await subscribe(owned, 'https://push.test/log/failed');
  const push = fakePush({ 'https://push.test/log/failed': 'failed' });

  await deliverNotification(owned, valid({ en: { title: 'News', body: 'Hi' } }), push.service);

  const [notification] = await listNotifications(owned.site.id);
  assert.equal(notification.kind, 'general');
  assert.deepEqual(notification.messages, { en: { title: 'News', body: 'Hi' } });
  assert.deepEqual(notification.deliveries, [
    { deviceLabel: 'iPhone, Safari', status: 'delivered' },
    { deviceLabel: null, status: 'failed' },
  ]);
  assert.deepEqual(deliverySummary(notification, owned.site), { sent: 1, removed: 0, total: 2, finishable: true });
});

test('finishing sends only what is outstanding, with the stored text', async () => {
  const owned = await ownedSite('finish-site');
  await subscribe(owned, 'https://push.test/finish/fine');
  await subscribe(owned, 'https://push.test/finish/failed');
  await deliverNotification(
    owned,
    valid({ en: { body: 'Hi' } }),
    fakePush({ 'https://push.test/finish/failed': 'failed' }).service
  );
  // Recipients are fixed when the Notification is sent.
  await subscribe(owned, 'https://push.test/finish/later');
  const [{ id }] = await listNotifications(owned.site.id);
  const push = fakePush();

  const result = await finishNotification(owned, id, push.service);

  assert.deepEqual(result, { sent: 2, removed: 0, total: 2 });
  assert.deepEqual(
    push.sent.map((s) => [s.endpoint, s.payload.body]),
    [['https://push.test/finish/failed', 'Hi']]
  );
  const [finished] = await listNotifications(owned.site.id);
  assert.equal(deliverySummary(finished, owned.site).finishable, false);
  assert.equal(await finishNotification(owned, id, push.service), null);
});

test('a Delivery stays with its Notification after the Subscription is gone', async () => {
  const owned = await ownedSite('gone-site');
  await subscribe(owned, 'https://push.test/keep/gone', null, 'Pixel, Chrome');
  await subscribe(owned, 'https://push.test/keep/fine', null, 'iPhone, Safari');
  await deliverNotification(
    owned,
    valid({ en: { body: 'Hi' } }),
    fakePush({ 'https://push.test/keep/gone': 'gone' }).service
  );

  await deleteSubscription(owned.site.id, pushEndpointSchema.parse('https://push.test/keep/fine'));

  const [notification] = await listNotifications(owned.site.id);
  assert.deepEqual(notification.deliveries, [
    { deviceLabel: 'Pixel, Chrome', status: 'gone' },
    { deviceLabel: 'iPhone, Safari', status: 'delivered' },
  ]);
  assert.deepEqual(deliverySummary(notification, owned.site), { sent: 1, removed: 1, total: 2, finishable: false });
});

test('finishing marks a Delivery gone when its Subscription no longer exists', async () => {
  const owned = await ownedSite('lost-site');
  await subscribe(owned, 'https://push.test/lost');
  await deliverNotification(
    owned,
    valid({ en: { body: 'Hi' } }),
    fakePush({ 'https://push.test/lost': 'failed' }).service
  );
  await deleteSubscription(owned.site.id, pushEndpointSchema.parse('https://push.test/lost'));
  const [{ id }] = await listNotifications(owned.site.id);
  const push = fakePush();

  assert.deepEqual(await finishNotification(owned, id, push.service), { sent: 0, removed: 1, total: 1 });
  assert.equal(push.sent.length, 0);
});

test('a send that stops leaves its Deliveries to finish', async () => {
  const owned = await ownedSite('stopped-site');
  for (let i = 0; i < 25; i += 1) {
    await subscribe(owned, `https://push.test/stopped/${i}`);
  }
  let sends = 0;
  const stopping: PushService = {
    send() {
      sends += 1;
      return sends > 20 ? Promise.reject(new Error('the Worker stopped')) : Promise.resolve('delivered');
    },
  };

  await assert.rejects(deliverNotification(owned, valid({ en: { body: 'Hi' } }), stopping));

  const [notification] = await listNotifications(owned.site.id);
  assert.deepEqual(deliverySummary(notification, owned.site), { sent: 20, removed: 0, total: 25, finishable: true });
  assert.deepEqual(await finishNotification(owned, notification.id, fakePush().service), {
    sent: 25,
    removed: 0,
    total: 25,
  });
});

test('a push endpoint that never answers fails without holding up the rest', async () => {
  const owned = await ownedSite('hung-site');
  await subscribe(owned, 'https://push.test/hung');
  await subscribe(owned, 'https://push.test/quick');
  const hanging: PushService = {
    send: (target) => (target.endpoint.endsWith('hung') ? new Promise(() => {}) : Promise.resolve('delivered')),
  };

  const result = await deliverNotification(owned, valid({ en: { body: 'Hi' } }), hanging, { sendTimeoutMs: 10 });

  assert.deepEqual(result, { sent: 1, removed: 0, total: 2 });
});

test("a Birth notification can't be finished while the Site is Waiting", async () => {
  const owned = await ownedSite('back-site');
  await subscribe(owned, 'https://push.test/back');
  await deliverNotification(
    owned,
    valid({ en: { body: 'She is here' } }),
    fakePush({ 'https://push.test/back': 'failed' }).service,
    {
      kind: 'birth',
    }
  );
  const [notification] = await listNotifications(owned.site.id);

  assert.equal(notification.kind, 'birth');
  assert.equal(deliverySummary(notification, owned.site).finishable, false);
  assert.equal(await finishNotification(owned, notification.id, fakePush().service), null);
  assert.deepEqual(unfinishedBirth([notification], owned.site), null);
});

test('an unfinished Birth notification is found once the Site is Born', async () => {
  const owned = await ownedSite('born-log-site', {
    sex: 'female',
    birth: {
      born: true,
      details: { datetime: '2026-01-15T08:30:00.000Z', weightGrams: null, lengthCm: null, message: {} },
    },
  });
  await subscribe(owned, 'https://push.test/born-log');
  await deliverNotification(
    owned,
    valid({ en: { body: 'She is here' } }),
    fakePush({ 'https://push.test/born-log': 'failed' }).service,
    {
      kind: 'birth',
    }
  );
  const logged = await listNotifications(owned.site.id);

  assert.equal(unfinishedBirth(logged, owned.site)?.id, logged[0].id);
});

test("another Site's Notification can't be finished", async () => {
  const owned = await ownedSite('owner-site');
  const other = await ownedSite('other-site');
  await subscribe(other, 'https://push.test/other');
  await deliverNotification(
    other,
    valid({ en: { body: 'Hi' } }),
    fakePush({ 'https://push.test/other': 'failed' }).service
  );
  const [{ id }] = await listNotifications(other.site.id);

  assert.equal(await finishNotification(owned, id, fakePush().service), null);
});
