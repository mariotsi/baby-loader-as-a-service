import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';

let stopDb: () => Promise<void>;
let ownerToken: () => string;
let otherToken: () => string;

before(async () => {
  stopDb = await startTestDb();
  const [ownerId, otherId] = [await insertTestUser(), await insertTestUser()];
  ownerToken = () => issueSessionToken(ownerId);
  otherToken = () => issueSessionToken(otherId);
  const parsed = parseNewSite({ slug: 'emma', settings: defaultSiteSettings });
  assert.ok(parsed.ok);
  const created = await createSite(authenticate(ownerToken()) as AuthenticatedUser, parsed.value);
  assert.ok(created.ok);
});

after(() => stopDb());

test('no session or a forged one is unauthenticated', async () => {
  assert.equal(authenticate(undefined), null);
  assert.equal(await accessOwnedSite(undefined, 'emma'), 'unauthenticated');
  const [userId, expiresAt] = ownerToken().split('.');
  assert.equal(await accessOwnedSite(`${userId}.${expiresAt}.forged`, 'emma'), 'unauthenticated');
});

test("a missing Site and another Owner's Site are both notFound", async () => {
  assert.equal(await accessOwnedSite(ownerToken(), 'nobody'), 'notFound');
  assert.equal(await accessOwnedSite(otherToken(), 'emma'), 'notFound');
});

test("the Owner gets their Site, whatever the Slug's case", async () => {
  const access = await accessOwnedSite(ownerToken(), 'EMMA');
  assert.ok(typeof access === 'object');
  assert.equal(access.site.slug, 'emma');
  assert.equal(access.site.ownerId, access.owner.id);
});
