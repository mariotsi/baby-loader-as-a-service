import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { startTestDb } from './testDb.ts';
import { issueSessionToken } from './auth.ts';
import { accessOwnedSite, authenticate, type AuthenticatedUser } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';

let stopDb: () => Promise<void>;
const ownerToken = issueSessionTokenLater();
const otherToken = issueSessionTokenLater();

/** Tokens need SESSION_SECRET, which startTestDb sets; issue them on first use. */
function issueSessionTokenLater() {
  const id = new ObjectId().toHexString();
  let token: string | undefined;
  return () => (token ??= issueSessionToken(id));
}

before(async () => {
  stopDb = await startTestDb();
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

test('a missing Site and another Owner\'s Site are both notFound', async () => {
  assert.equal(await accessOwnedSite(ownerToken(), 'nobody'), 'notFound');
  assert.equal(await accessOwnedSite(otherToken(), 'emma'), 'notFound');
});

test('the Owner gets their Site, whatever the Slug\'s case', async () => {
  const access = await accessOwnedSite(ownerToken(), 'EMMA');
  assert.ok(typeof access === 'object');
  assert.equal(access.site.slug, 'emma');
  assert.ok(access.site.ownerId.equals(access.owner.id));
});
