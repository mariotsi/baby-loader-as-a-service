import { afterAll, assert, beforeAll, expect, test } from 'vitest';
import { insertTestUser, startTestDb, testSubscription } from '../db/testDb.ts';
import { createUser, EmailTakenError, getUserByEmail, getUserById } from './auth.ts';
import { emailSchema } from './email.ts';
import type { AuthenticatedUser } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';
import { countSubscriptionsBySite, listSubscriptionsBySite, upsertSubscription } from './subscription.ts';

let stopDb: () => Promise<void>;

beforeAll(async () => {
  stopDb = await startTestDb();
});

afterAll(() => stopDb());

test('an email has one account, whatever its case', async () => {
  const user = await createUser(emailSchema.parse('Ada@Example.com '), 'Correct-horse-1');
  expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
  expect((await getUserByEmail('ada@example.com'))?.id).toBe(user.id);
  expect((await getUserById(user.id))?.email).toBe('ada@example.com');
  await expect(createUser(emailSchema.parse('ADA@example.com'), 'Another-horse-2')).rejects.toBeInstanceOf(
    EmailTakenError
  );
});

test('an id of the wrong shape matches no User', async () => {
  expect(await getUserById('not-an-id')).toBe(null);
});

test('a device subscribed twice to one Site is one Subscription, refreshed', async () => {
  const owner = { id: await insertTestUser() } as AuthenticatedUser;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const parsed = parseNewSite({ slug: 'ivy', settings: { ...defaultSiteSettings, dueDate } });
  assert(parsed.ok);
  const created = await createSite(owner, parsed.value);
  assert(created.ok);
  const subscription = {
    siteId: created.site.id,
    subscription: testSubscription('https://push.example/ivy'),
    lang: null,
    deviceInfo: null,
    geo: null,
  };

  await upsertSubscription(subscription);
  const refreshed = testSubscription('https://push.example/ivy');
  await upsertSubscription({ ...subscription, subscription: refreshed, lang: 'it' });

  expect(await countSubscriptionsBySite(created.site.id)).toBe(1);
  const [stored] = await listSubscriptionsBySite(created.site.id);
  expect(stored.keys).toStrictEqual(refreshed.keys);
  expect(stored.lang).toBe('it');
});
