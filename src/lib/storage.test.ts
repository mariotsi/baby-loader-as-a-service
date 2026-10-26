import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { createUser, EmailTakenError, getUserByEmail, getUserById } from './auth.ts';
import type { AuthenticatedUser } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';
import { countSubscriptionsBySite, listSubscriptionsBySite, upsertSubscription } from './subscription.ts';

let stopDb: () => Promise<void>;

before(async () => {
  stopDb = await startTestDb();
});

after(() => stopDb());

test('an email has one account, whatever its case', async () => {
  const user = await createUser('Ada@Example.com ', 'Correct-horse-1');
  assert.match(user.id, /^[0-9a-f]{24}$/);
  assert.equal((await getUserByEmail('ada@example.com'))?.id, user.id);
  assert.equal((await getUserById(user.id))?.email, 'ada@example.com');
  await assert.rejects(createUser('ADA@example.com', 'Another-horse-2'), EmailTakenError);
});

test('an id of the wrong shape matches no User', async () => {
  assert.equal(await getUserById('not-an-id'), null);
});

test('a device subscribed twice to one Site is one Subscription, refreshed', async () => {
  const owner = { id: await insertTestUser() } as AuthenticatedUser;
  const parsed = parseNewSite({ slug: 'ivy', settings: defaultSiteSettings });
  assert.ok(parsed.ok);
  const created = await createSite(owner, parsed.value);
  assert.ok(created.ok);
  const subscription = {
    siteId: created.site.id,
    endpoint: 'https://push.example/ivy',
    keys: { p256dh: 'first', auth: 'auth' },
    lang: null,
    deviceInfo: null,
    geo: null,
  };

  await upsertSubscription(subscription);
  await upsertSubscription({ ...subscription, keys: { p256dh: 'second', auth: 'auth' }, lang: 'it' });

  assert.equal(await countSubscriptionsBySite(created.site.id), 1);
  const [stored] = await listSubscriptionsBySite(created.site.id);
  assert.deepEqual(stored.keys, { p256dh: 'second', auth: 'auth' });
  assert.equal(stored.lang, 'it');
});
