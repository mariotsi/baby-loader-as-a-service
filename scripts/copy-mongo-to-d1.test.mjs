import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { hashPassword, verifyPassword } from '../src/lib/password.ts';
import { defaultSiteSettings } from '../src/lib/siteSettings.ts';

const TARGET = 'loading-baby-staging';
let mongo;
let client;
let persistTo;

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function copy(...extra) {
  return execFileSync(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      'scripts/copy-mongo-to-d1.mjs',
      '--source-uri',
      mongo.getUri(),
      '--source-db',
      'source',
      '--target',
      TARGET,
      '--persist-to',
      persistTo,
      ...extra,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function query(sql) {
  const out = wrangler(['d1', 'execute', TARGET, '--local', '--persist-to', persistTo, '--json', '--command', sql]);
  return JSON.parse(out)[0].results;
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  client = await new MongoClient(mongo.getUri()).connect();
  persistTo = mkdtempSync(join(tmpdir(), 'copy-test-'));
  wrangler(['d1', 'migrations', 'apply', TARGET, '--local', '--persist-to', persistTo]);

  const db = client.db('source');
  const ownerId = new ObjectId();
  const siteId = new ObjectId();
  const saved = new Date('2026-09-01T10:00:00.000Z');
  await db
    .collection('users')
    .insertMany([
      { _id: ownerId, email: 'Ada@Example.com', passwordHash: await hashPassword('Copied-horse-1'), createdAt: saved },
    ]);
  await db.collection('sites').insertMany([
    {
      ...defaultSiteSettings,
      babyName: 'Ada',
      dueDate: '2027-01-15',
      _id: siteId,
      slug: 'ada',
      ownerId,
      createdAt: saved,
      updatedAt: saved,
      customDomain: null,
      customDomainVerified: false,
    },
    // Its Owner is gone, so the copy reports it and moves on.
    {
      ...defaultSiteSettings,
      _id: new ObjectId(),
      slug: 'orphan',
      ownerId: new ObjectId(),
      createdAt: saved,
      updatedAt: saved,
    },
  ]);
  await db.collection('subscriptions').insertOne({
    _id: new ObjectId(),
    siteId,
    endpoint: 'https://push.example/ada',
    keys: { p256dh: 'p256dh', auth: 'auth' },
    lang: 'en',
    deviceInfo: null,
    geo: null,
    createdAt: saved,
    updatedAt: saved,
  });
});

after(async () => {
  await client?.close();
  await mongo?.stop();
  rmSync(persistTo, { recursive: true, force: true });
});

test('a dry run reports what it would copy and writes nothing', () => {
  const out = copy('--dry-run');
  assert.match(out, /Skipping sites .*: its Owner is missing/);
  assert.match(out, /Dry run: 3 rows would be upserted/);
  assert.equal(query('SELECT count(*) AS n FROM users')[0].n, 0);
});

test('the copy gives every row a new id and keeps every relation', async () => {
  assert.match(copy(), /Wrote 3 rows .* skipped 1/);
  const [user] = query('SELECT id, email, password_hash FROM users');
  assert.match(user.id, /^[0-9a-f-]{36}$/);
  assert.equal(user.email, 'ada@example.com');
  assert.equal(await verifyPassword('Copied-horse-1', user.password_hash), 'valid');

  const [site] = query('SELECT id, owner_id, settings FROM sites');
  assert.equal(site.owner_id, user.id);
  assert.equal(JSON.parse(site.settings).babyName, 'Ada');

  const [sub] = query('SELECT site_id, lang FROM subscriptions');
  assert.equal(sub.site_id, site.id);
  assert.equal(sub.lang, 'en');
});

test('a second run writes nothing and keeps the ids', () => {
  const idsBefore = query('SELECT id FROM users UNION ALL SELECT id FROM sites UNION ALL SELECT id FROM subscriptions');
  assert.match(copy(), /Wrote 0 rows/);
  assert.deepEqual(
    query('SELECT id FROM users UNION ALL SELECT id FROM sites UNION ALL SELECT id FROM subscriptions'),
    idsBefore
  );
});
