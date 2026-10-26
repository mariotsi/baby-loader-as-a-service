import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ObjectId } from 'mongodb';
import { issueSessionToken } from './auth.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, signIn } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';
import { startTestDb } from './testDb.ts';

let stopDb: () => Promise<void>;
const ownerId = new ObjectId().toHexString();
const ownerToken = issueSessionTokenLater(ownerId);
const otherToken = issueSessionTokenLater(new ObjectId().toHexString());
const pendingToken = issueSessionTokenLater(ownerId, true);

/** Tokens need SESSION_SECRET, which startTestDb sets; issue them on first use. */
function issueSessionTokenLater(id: string, passwordChangePending = false) {
  let token: string | undefined;
  return () => (token ??= issueSessionToken(id, { passwordChangePending }));
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

test("a missing Site and another Owner's Site are both notFound", async () => {
  assert.equal(await accessOwnedSite(ownerToken(), 'nobody'), 'notFound');
  assert.equal(await accessOwnedSite(otherToken(), 'emma'), 'notFound');
});

test("the Owner gets their Site, whatever the Slug's case", async () => {
  const access = await accessOwnedSite(ownerToken(), 'EMMA');
  assert.ok(typeof access === 'object');
  assert.equal(access.site.slug, 'emma');
  assert.ok(access.site.ownerId.equals(access.owner.id));
});

test("a session with a password change pending is signed in, but reaches no Site, not even the Owner's", async () => {
  assert.equal(signIn(pendingToken())?.passwordChangePending, true);
  assert.equal(signIn(ownerToken())?.passwordChangePending, false);
  assert.equal(authenticate(pendingToken()), null);
  assert.equal(await accessOwnedSite(pendingToken(), 'emma'), 'passwordChangePending');
});

test('the pending mark cannot be added to or removed from a signed token', () => {
  const [userId, expiresAt, signature] = ownerToken().split('.');
  assert.equal(signIn(`${userId}.${expiresAt}.change.${signature}`), null);
  const [pendingId, pendingExpiresAt, , pendingSignature] = pendingToken().split('.');
  assert.equal(signIn(`${pendingId}.${pendingExpiresAt}.${pendingSignature}`), null);
  assert.equal(signIn(`${userId}.${expiresAt}.other.${signature}`), null);
});
