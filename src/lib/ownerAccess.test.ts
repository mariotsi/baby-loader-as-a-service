import { afterAll, assert, beforeAll, expect, test } from 'vitest';
import { insertTestUser, startTestDb } from '../db/testDb.ts';
import { issueSessionToken } from './auth.ts';
import { type AuthenticatedUser, accessOwnedSite, authenticate, signIn } from './ownerAccess.ts';
import { createSite } from './site.ts';
import { defaultSiteSettings, parseNewSite } from './siteSettings.ts';

let stopDb: () => Promise<void>;
let ownerToken: () => string;
let otherToken: () => string;
let pendingToken: () => string;

beforeAll(async () => {
  stopDb = await startTestDb();
  const [ownerId, otherId] = [await insertTestUser(), await insertTestUser()];
  ownerToken = () => issueSessionToken(ownerId);
  otherToken = () => issueSessionToken(otherId);
  pendingToken = () => issueSessionToken(ownerId, { passwordChangePending: true });
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const parsed = parseNewSite({ slug: 'emma', settings: { ...defaultSiteSettings, dueDate } });
  assert(parsed.ok);
  const created = await createSite(authenticate(ownerToken()) as AuthenticatedUser, parsed.value);
  expect(created.ok).toBeTruthy();
});

afterAll(() => stopDb());

test('no session or a forged one is unauthenticated', async () => {
  expect(authenticate(undefined)).toBe(null);
  expect(await accessOwnedSite(undefined, 'emma')).toBe('unauthenticated');
  const [userId, expiresAt] = ownerToken().split('.');
  expect(await accessOwnedSite(`${userId}.${expiresAt}.forged`, 'emma')).toBe('unauthenticated');
});

test("a missing Site and another Owner's Site are both notFound", async () => {
  expect(await accessOwnedSite(ownerToken(), 'nobody')).toBe('notFound');
  expect(await accessOwnedSite(otherToken(), 'emma')).toBe('notFound');
});

test("the Owner gets their Site, whatever the Slug's case", async () => {
  const access = await accessOwnedSite(ownerToken(), 'EMMA');
  assert(typeof access === 'object');
  expect(access.site.slug).toBe('emma');
  expect(access.site.ownerId).toBe(access.owner.id);
});

test("a session with a password change pending is signed in, but reaches no Site, not even the Owner's", async () => {
  expect(signIn(pendingToken())?.passwordChangePending).toBe(true);
  expect(signIn(ownerToken())?.passwordChangePending).toBe(false);
  expect(authenticate(pendingToken())).toBe(null);
  expect(await accessOwnedSite(pendingToken(), 'emma')).toBe('passwordChangePending');
});

test('the pending mark cannot be added to or removed from a signed token', () => {
  const [userId, expiresAt, signature] = ownerToken().split('.');
  expect(signIn(`${userId}.${expiresAt}.change.${signature}`)).toBe(null);
  const [pendingId, pendingExpiresAt, , pendingSignature] = pendingToken().split('.');
  expect(signIn(`${pendingId}.${pendingExpiresAt}.${pendingSignature}`)).toBe(null);
  expect(signIn(`${userId}.${expiresAt}.other.${signature}`)).toBe(null);
});
