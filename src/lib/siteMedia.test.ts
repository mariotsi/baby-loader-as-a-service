import { assert, expect, test } from 'vitest';
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
import { type BirthMedia, defaultSiteSettings, isoDateTimeSchema } from './siteSettings.ts';

const asInstant = (value: string) => isoDateTimeSchema.parse(value);

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
  assert(isMediaKey(key));
  return { key, url: `https://media.test/${key}` };
}

test('an upload lands in its Site’s folder under a random key, at the media domain', async () => {
  const { media, keys } = setup();
  const { key, url } = await media.upload(owned(), photo());
  expect(key).toMatch(new RegExp(`^customer-data/${OWNER_ID}/${SITE_ID}/[0-9a-f-]{36}$`));
  expect(url).toBe(`https://media.test/${key}`);
  expect(keys()).toStrictEqual([key]);
  expect((await media.upload(owned(), photo())).key).not.toBe(key);
});

test('only accepted types within their size limit are stored', async () => {
  const { media, keys } = setup();
  await expect(media.upload(owned(), new Blob(['x'], { type: 'text/html' }))).rejects.toBeInstanceOf(
    UnsupportedMediaTypeError
  );
  await expect(media.upload(owned(), new Blob([], { type: 'image/png' }))).rejects.toBeInstanceOf(MediaTooLargeError);
  const tooBig = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' });
  await expect(media.upload(owned(), tooBig)).rejects.toBeInstanceOf(MediaTooLargeError);
  expect(keys()).toStrictEqual([]);
});

test('a Site owns only its own keys, at their own URL', async () => {
  const { media } = setup();
  const { key, url } = await media.upload(owned(), photo());
  expect(media.owns(site(), stored(key))).toBe(true);
  expect(media.owns(site(), { ...stored(key), url: `${url}?x` })).toBe(false);
  expect(media.owns(site({ id: OTHER_SITE_ID }), stored(key))).toBe(false);
});

test('an Owner removes an unused upload of their Site, never one in use or another Site’s', async () => {
  const { media, keys, purged } = setup();
  const unused = await media.upload(owned(), photo());
  const inUse = await media.upload(owned(), photo());
  const withVideo = site({ birthVideo: stored(inUse.key) });

  await expect(media.remove(owned(withVideo), inUse.key)).rejects.toBeInstanceOf(MediaNotFoundError);
  await expect(media.remove(owned(site({ id: OTHER_SITE_ID })), unused.key)).rejects.toBeInstanceOf(MediaNotFoundError);
  await expect(media.remove(owned(), '../secrets')).rejects.toBeInstanceOf(MediaNotFoundError);
  await expect(media.remove(owned(), undefined)).rejects.toBeInstanceOf(MediaNotFoundError);

  await media.remove(owned(withVideo), unused.key);
  expect(keys()).toStrictEqual([inUse.key]);
  expect(purged).toStrictEqual([unused.url]);
});

test('a failed purge says the file is gone but may still be served', async () => {
  const { media, keys } = setup(() => Promise.reject(new Error('API down')));
  const { key } = await media.upload(owned(), photo());
  await expect(media.remove(owned(), key)).rejects.toBeInstanceOf(MediaCachePurgeError);
  expect(keys()).toStrictEqual([]);
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
  expect(keys().length, 'nothing is a day old yet').toBe(4);

  later(2000);
  const latest = await media.upload(owned(current), photo());
  expect(keys().sort(byText)).toStrictEqual([kept.key, othersFile.key, fresh.key, latest.key].sort(byText));
  expect(!keys().includes(abandoned.key)).toBeTruthy();
});

test('a sweep that cannot delete still stores the upload, and logs', async () => {
  const { media, keys, logged, later } = setup(() => Promise.reject(new Error('API down')));
  const abandoned = await media.upload(owned(), photo());
  later(ORPHAN_AGE_MS + 1);
  const next = await media.upload(owned(), photo());
  expect(keys(), 'the file left storage before its purge failed').toStrictEqual([next.key]);
  expect(logged).toStrictEqual([`Could not remove Site media ${abandoned.key}`]);
});

test('a save removes the files it replaced and keeps the ones it still uses', async () => {
  const { media, keys } = setup();
  const video = await media.upload(owned(), photo());
  const oldPhoto = await media.upload(owned(), photo());
  const newPhoto = await media.upload(owned(), photo());
  const details = { datetime: asInstant('2026-11-01T10:00:00.000Z'), weightGrams: null, lengthCm: null, message: {} };
  const before = site({
    birthVideo: stored(video.key),
    birth: { born: true, details: { ...details, photo: stored(oldPhoto.key) } },
  });
  const after = site({
    birthVideo: stored(video.key),
    birth: { born: true, details: { ...details, photo: stored(newPhoto.key) } },
  });
  await media.removeReplaced(before, after);
  expect(keys().sort(byText)).toStrictEqual([video.key, newPhoto.key].sort(byText));
});

test('the page’s origin serves only the file the Site points at now, by range too', async () => {
  const { media } = setup();
  const bytes = new Uint8Array(100).map((_, i) => i);
  const { key } = await media.upload(owned(), new Blob([bytes], { type: 'video/mp4' }));
  const replaced = await media.upload(owned(), photo());
  const current = site({ birthVideo: stored(key) });

  const whole = await media.read(current, 'video', key, new Headers());
  expect(whole?.status).toBe(200);
  expect(whole?.headers.get('content-type')).toBe('video/mp4');
  expect(whole?.headers.get('cache-control')).toBe('private, no-store');
  expect((await whole?.arrayBuffer())?.byteLength).toBe(100);

  const part = await media.read(current, 'video', key, new Headers({ range: 'bytes=10-19' }));
  expect(part?.status).toBe(206);
  expect(part?.headers.get('content-range')).toBe('bytes 10-19/100');
  expect([...new Uint8Array((await part?.arrayBuffer()) ?? new ArrayBuffer(0))]).toStrictEqual([
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  ]);

  const tail = await media.read(current, 'video', key, new Headers({ range: 'bytes=-5' }));
  expect(tail?.headers.get('content-range')).toBe('bytes 95-99/100');

  expect(await media.read(current, 'video', replaced.key, new Headers())).toBe(null);
  expect(await media.read(current, 'photo', key, new Headers())).toBe(null);
  expect(await media.read(current, 'video', null, new Headers())).toBe(null);
});
