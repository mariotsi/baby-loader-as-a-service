import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siteIdSchema, userIdSchema } from '../db/ids.ts';
import { slugSchema } from './address.ts';
import { type CachePurge, memoryMediaStore, noCachePurge } from './mediaStore.ts';
import type { OwnedSite } from './ownerAccess.ts';
import type { Site } from './site.ts';
import {
  isMediaKey,
  MediaCachePurgeError,
  MediaNotFoundError,
  MediaTooLargeError,
  ORPHAN_AGE_MS,
  siteMedia,
  UnsupportedMediaTypeError,
} from './siteMedia.ts';
import { type BirthMedia, defaultSiteSettings } from './siteSettings.ts';

const OWNER_ID = userIdSchema.parse('6f1d2c3b-4a5e-4f60-8172-839405a6b7c8');
const SITE_ID = siteIdSchema.parse('7a2e3d4c-5b6f-4071-9283-94a516b7c8d9');
const OTHER_SITE_ID = siteIdSchema.parse('8b3f4e5d-6c70-4182-a394-a5b6c7d8e9f0');

function site(overrides: Partial<Site> = {}): Site {
  return {
    ...defaultSiteSettings,
    id: SITE_ID,
    ownerId: OWNER_ID,
    slug: slugSchema.parse('leo'),
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    customDomain: null,
    customDomainVerified: false,
    ...overrides,
  };
}

function owned(of: Site = site()): OwnedSite {
  return { owner: { id: of.ownerId }, site: of } as unknown as OwnedSite;
}

/** Site media in memory, on a clock the test moves, recording each purge and log line. */
function setup(purge: CachePurge = noCachePurge) {
  let now = new Date('2026-11-06T12:00:00Z');
  const memory = memoryMediaStore(() => now);
  const purged: string[] = [];
  const logged: string[] = [];
  const media = siteMedia({
    store: memory.store,
    purge: (url) => {
      purged.push(url);
      return purge(url);
    },
    publicUrl: 'https://media.test',
    now: () => now,
    log: (message) => logged.push(message),
  });
  return {
    media,
    keys: memory.keys,
    purged,
    logged,
    later(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

const byText = (a: string, b: string) => a.localeCompare(b);

const photo = () => new Blob([new Uint8Array(1000)], { type: 'image/jpeg' });

function stored(key: string): BirthMedia {
  assert.ok(isMediaKey(key));
  return { key, url: `https://media.test/${key}` };
}

test('an upload lands in its Site’s folder under a random key, at the media domain', async () => {
  const { media, keys } = setup();
  const { key, url } = await media.upload(owned(), photo());
  assert.match(key, new RegExp(`^customer-data/${OWNER_ID}/${SITE_ID}/[0-9a-f-]{36}$`));
  assert.equal(url, `https://media.test/${key}`);
  assert.deepEqual(keys(), [key]);
  assert.notEqual((await media.upload(owned(), photo())).key, key);
});

test('only accepted types within their size limit are stored', async () => {
  const { media, keys } = setup();
  await assert.rejects(media.upload(owned(), new Blob(['x'], { type: 'text/html' })), UnsupportedMediaTypeError);
  await assert.rejects(media.upload(owned(), new Blob([], { type: 'image/png' })), MediaTooLargeError);
  const tooBig = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' });
  await assert.rejects(media.upload(owned(), tooBig), MediaTooLargeError);
  assert.deepEqual(keys(), []);
});

test('a Site owns only its own keys, at their own URL', async () => {
  const { media } = setup();
  const { key, url } = await media.upload(owned(), photo());
  assert.equal(media.owns(site(), stored(key)), true);
  assert.equal(media.owns(site(), { ...stored(key), url: `${url}?x` }), false);
  assert.equal(media.owns(site({ id: OTHER_SITE_ID }), stored(key)), false);
});

test('an Owner removes an unused upload of their Site, never one in use or another Site’s', async () => {
  const { media, keys, purged } = setup();
  const unused = await media.upload(owned(), photo());
  const inUse = await media.upload(owned(), photo());
  const withVideo = site({ birthVideo: stored(inUse.key) });

  await assert.rejects(media.remove(owned(withVideo), inUse.key), MediaNotFoundError);
  await assert.rejects(media.remove(owned(site({ id: OTHER_SITE_ID })), unused.key), MediaNotFoundError);
  await assert.rejects(media.remove(owned(), '../secrets'), MediaNotFoundError);
  await assert.rejects(media.remove(owned(), undefined), MediaNotFoundError);

  await media.remove(owned(withVideo), unused.key);
  assert.deepEqual(keys(), [inUse.key]);
  assert.deepEqual(purged, [unused.url]);
});

test('a failed purge says the file is gone but may still be served', async () => {
  const { media, keys } = setup(() => Promise.reject(new Error('API down')));
  const { key } = await media.upload(owned(), photo());
  await assert.rejects(media.remove(owned(), key), MediaCachePurgeError);
  assert.deepEqual(keys(), []);
});

test('an upload sweeps the Site’s files nothing uses once they are a day old', async () => {
  const { media, keys, later } = setup();
  const abandoned = await media.upload(owned(), photo());
  const kept = await media.upload(owned(), photo());
  const other = site({ id: OTHER_SITE_ID });
  const othersFile = await media.upload(owned(other), photo());
  const current = site({ birthVideo: stored(kept.key) });

  later(ORPHAN_AGE_MS - 1000);
  const fresh = await media.upload(owned(current), photo());
  assert.equal(keys().length, 4, 'nothing is a day old yet');

  later(2000);
  const latest = await media.upload(owned(current), photo());
  assert.deepEqual(keys().sort(byText), [kept.key, othersFile.key, fresh.key, latest.key].sort(byText));
  assert.ok(!keys().includes(abandoned.key));
});

test('a sweep that cannot delete still stores the upload, and logs', async () => {
  const { media, keys, logged, later } = setup(() => Promise.reject(new Error('API down')));
  const abandoned = await media.upload(owned(), photo());
  later(ORPHAN_AGE_MS + 1);
  const next = await media.upload(owned(), photo());
  assert.deepEqual(keys(), [next.key], 'the file left storage before its purge failed');
  assert.deepEqual(logged, [`Could not remove Site media ${abandoned.key}`]);
});

test('a save removes the files it replaced and keeps the ones it still uses', async () => {
  const { media, keys } = setup();
  const video = await media.upload(owned(), photo());
  const oldPhoto = await media.upload(owned(), photo());
  const newPhoto = await media.upload(owned(), photo());
  const details = { datetime: '2026-11-01T10:00:00.000Z', weightGrams: null, lengthCm: null, message: {} };
  const before = site({
    birthVideo: stored(video.key),
    birth: { born: true, details: { ...details, photo: stored(oldPhoto.key) } },
  });
  const after = site({
    birthVideo: stored(video.key),
    birth: { born: true, details: { ...details, photo: stored(newPhoto.key) } },
  });
  await media.removeReplaced(before, after);
  assert.deepEqual(keys().sort(byText), [video.key, newPhoto.key].sort(byText));
});

test('the page’s origin serves only the file the Site points at now, by range too', async () => {
  const { media } = setup();
  const bytes = new Uint8Array(100).map((_, i) => i);
  const { key } = await media.upload(owned(), new Blob([bytes], { type: 'video/mp4' }));
  const replaced = await media.upload(owned(), photo());
  const current = site({ birthVideo: stored(key) });

  const whole = await media.read(current, 'video', key, new Headers());
  assert.equal(whole?.status, 200);
  assert.equal(whole?.headers.get('content-type'), 'video/mp4');
  assert.equal(whole?.headers.get('cache-control'), 'private, no-store');
  assert.equal((await whole?.arrayBuffer())?.byteLength, 100);

  const part = await media.read(current, 'video', key, new Headers({ range: 'bytes=10-19' }));
  assert.equal(part?.status, 206);
  assert.equal(part?.headers.get('content-range'), 'bytes 10-19/100');
  assert.deepEqual(
    [...new Uint8Array((await part?.arrayBuffer()) ?? new ArrayBuffer(0))],
    [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
  );

  const tail = await media.read(current, 'video', key, new Headers({ range: 'bytes=-5' }));
  assert.equal(tail?.headers.get('content-range'), 'bytes 95-99/100');

  assert.equal(await media.read(current, 'video', replaced.key, new Headers()), null);
  assert.equal(await media.read(current, 'photo', key, new Headers()), null);
  assert.equal(await media.read(current, 'video', null, new Headers()), null);
});
