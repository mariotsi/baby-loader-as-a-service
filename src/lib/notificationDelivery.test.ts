import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import type { Lang } from './i18n.ts';
import {
  deliverNotification,
  type PushOutcome,
  type PushService,
  type PushTarget,
  parseNotification,
} from './notificationDelivery.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, type OwnedSite } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite, type SiteSettingsInput } from './siteSettings.ts';
import { countSubscriptionsBySite, upsertSubscription } from './subscription.ts';

let stopDb: () => Promise<void>;
let token: string;

before(async () => {
  stopDb = await startTestDb();
  token = issueSessionToken(await insertTestUser());
});

after(() => stopDb());

async function ownedSite(slug: string, settings: Partial<SiteSettingsInput> = {}): Promise<OwnedSite> {
  const parsed = parseNewSite({ slug, settings: { ...defaultSiteSettings, babyName: 'Emma', ...settings } });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  assert.ok((await createSite(authenticate(token) as AuthenticatedUser, parsed.value)).ok);
  const access = await accessOwnedSite(token, slug);
  assert.ok(typeof access === 'object');
  return access;
}

async function subscribe(owned: OwnedSite, endpoint: string, lang: Lang | null = null) {
  await upsertSubscription({
    siteId: owned.site.id,
    endpoint,
    keys: { p256dh: 'p256dh', auth: 'auth' },
    lang,
    deviceInfo: null,
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

test("the payload opens the Site's Address, with its tag and a default title", async () => {
  const owned = await ownedSite('payload-site');
  await subscribe(owned, 'https://push.test/payload');
  const push = fakePush();

  await deliverNotification(owned, valid({ en: { body: 'Hi' } }), push.service);

  assert.deepEqual(push.sent[0].payload, { title: 'Emma', body: 'Hi', url: '/', tag: 'site-payload-site' });
});

test('no default title while Privacy settings hide the name', async () => {
  const owned = await ownedSite('hidden-site', { privacy: { showName: false, showSex: true } });
  await subscribe(owned, 'https://push.test/hidden');
  const push = fakePush();

  await deliverNotification(owned, valid({ en: { body: 'Hi' } }), push.service);

  assert.equal('title' in push.sent[0].payload, false);
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
