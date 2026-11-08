/**
 * A Site's media: the photo and Birth video its Owner uploads. This module
 * owns every rule about them: which files are accepted, the key each one is
 * stored under, which keys belong to a Site, reading one back, and removing
 * what a Site no longer uses. Files live in a MediaStore (mediaStore.ts).
 */
import * as z from 'zod/mini';
import { type CachePurge, type MediaStore, mediaResponse } from './mediaStore.ts';
import type { OwnedSite } from './ownerAccess.ts';
import type { Site } from './site.ts';
import type { BirthMedia } from './siteSettings.ts';

const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const VIDEO_LIMIT_BYTES = 50 * 1024 * 1024;

/** Every type an Owner may upload, with its size limit in bytes. */
export const MEDIA_TYPE_LIMITS = {
  'image/avif': IMAGE_LIMIT_BYTES,
  'image/jpeg': IMAGE_LIMIT_BYTES,
  'image/png': IMAGE_LIMIT_BYTES,
  'image/webp': IMAGE_LIMIT_BYTES,
  'video/mp4': VIDEO_LIMIT_BYTES,
  'video/webm': VIDEO_LIMIT_BYTES,
} as const;
export type MediaType = keyof typeof MEDIA_TYPE_LIMITS;
export const MEDIA_TYPES = Object.keys(MEDIA_TYPE_LIMITS) as [MediaType, ...MediaType[]];
export const MAX_MEDIA_BYTES = VIDEO_LIMIT_BYTES;

const CUSTOMER_DATA = 'customer-data';
const ID = '[0-9A-Za-z-]+';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Where an uploaded file is stored: `customer-data/<owner id>/<site id>/<random uuid>`. */
export const mediaKeySchema = z
  .string()
  .check(z.regex(new RegExp(`^${CUSTOMER_DATA}/${ID}/${ID}/${UUID}$`), 'must be a Site media key'))
  .brand<'MediaKey'>();
export type MediaKey = z.output<typeof mediaKeySchema>;
export function isMediaKey(value: unknown): value is MediaKey {
  return mediaKeySchema.safeParse(value).success;
}

/** The folder holding every file of one Site. */
function sitePrefix(site: Pick<Site, 'id' | 'ownerId'>): string {
  return `${CUSTOMER_DATA}/${site.ownerId}/${site.id}/`;
}

/** Whether `key` names a file of this Site. */
export function isSiteMediaKey(site: Pick<Site, 'id' | 'ownerId'>, key: unknown): key is MediaKey {
  return isMediaKey(key) && key.startsWith(sitePrefix(site));
}

function newMediaKey(site: Pick<Site, 'id' | 'ownerId'>): MediaKey {
  return `${sitePrefix(site)}${crypto.randomUUID()}` as MediaKey;
}

/** The keys a Site's settings point at. */
function keysInUse(site: Site): Set<string> {
  return new Set([site.birth.details?.photo?.key, site.birthVideo?.key].filter((key) => !!key) as string[]);
}

export class UnsupportedMediaTypeError extends Error {}
export class MediaTooLargeError extends Error {}
/** The key is not one of this Site's: malformed, or another Site's. */
export class MediaNotFoundError extends Error {}
/** The file is gone from storage, but the media domain may still serve its cached copy. */
export class MediaCachePurgeError extends Error {}

export interface StoredMedia {
  key: MediaKey;
  url: string;
}

export type BirthMediaKind = 'photo' | 'video';

/** An upload no save points at is removed once it is this old. */
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

export interface SiteMediaDeps {
  store: MediaStore;
  /** Drops a deleted file's URL from the media domain's cache. */
  purge: CachePurge;
  /** The media domain's origin, without a trailing slash. */
  publicUrl: string;
  now?: () => Date;
  log?: (message: string, error: unknown) => void;
}

export type SiteMedia = ReturnType<typeof siteMedia>;

export function siteMedia({ store, purge, publicUrl, now = () => new Date(), log = console.error }: SiteMediaDeps) {
  function urlOf(key: MediaKey): string {
    return `${publicUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Deletes a file and drops it from the cache; throws MediaCachePurgeError when only the purge failed. */
  async function erase(key: MediaKey): Promise<void> {
    await store.delete(key);
    try {
      await purge(urlOf(key));
    } catch (error) {
      throw new MediaCachePurgeError('The file was deleted, but the media domain may still serve it.', {
        cause: error,
      });
    }
  }

  /** Deletes a file nothing points at any more; a failure is logged, and the next sweep tries again. */
  async function discard(key: MediaKey): Promise<void> {
    try {
      await erase(key);
    } catch (error) {
      log(`Could not remove Site media ${key}`, error);
    }
  }

  /**
   * Removes the Site's files older than ORPHAN_AGE_MS that its settings do
   * not point at: uploads from a save that failed or a tab closed before
   * saving, and replaced files whose removal failed.
   */
  async function sweep(site: Site): Promise<void> {
    const inUse = keysInUse(site);
    const before = now().getTime() - ORPHAN_AGE_MS;
    for (const { key, uploaded } of await store.list(sitePrefix(site))) {
      if (!inUse.has(key) && uploaded.getTime() < before && isMediaKey(key)) {
        await discard(key);
      }
    }
  }

  return {
    publicUrl: urlOf,

    /** Stores a file for the Owner's Site, then sweeps the Site's orphans. */
    async upload(owned: OwnedSite, file: Blob): Promise<StoredMedia> {
      const limit = MEDIA_TYPE_LIMITS[file.type as MediaType];
      if (!limit) {
        throw new UnsupportedMediaTypeError('This media type is not supported.');
      }
      if (file.size === 0 || file.size > limit) {
        throw new MediaTooLargeError('This media file is empty or exceeds its size limit.');
      }
      const key = newMediaKey(owned.site);
      await store.put(key, file);
      try {
        await sweep(owned.site);
      } catch (error) {
        log(`Could not sweep the media of Site ${owned.site.id}`, error);
      }
      return { key, url: urlOf(key) };
    },

    /** Removes one of the Owner's uploads, as the editor does after a save that failed. */
    async remove(owned: OwnedSite, key: unknown): Promise<void> {
      if (!isSiteMediaKey(owned.site, key) || keysInUse(owned.site).has(key)) {
        throw new MediaNotFoundError('This is not media the Site can remove.');
      }
      await erase(key);
    },

    /** Whether a file a save points at is one of this Site's, at its own URL. */
    owns(site: Site, media: BirthMedia): boolean {
      return isSiteMediaKey(site, media.key) && media.url === urlOf(media.key);
    },

    /** Removes the files `before` pointed at and `after` no longer does. Never throws. */
    async removeReplaced(before: Site, after: Site): Promise<void> {
      const kept = keysInUse(after);
      for (const key of keysInUse(before)) {
        if (!kept.has(key) && isSiteMediaKey(before, key)) {
          await discard(key);
        }
      }
    },

    /**
     * Serves the Site's photo or Birth video from the page's own origin, only
     * when `key` is the one its settings point at now, so an old link stops
     * working once the file is replaced. Null when there is nothing to serve.
     */
    async read(site: Site, kind: BirthMediaKind, key: string | null, request: Headers): Promise<Response | null> {
      const media = kind === 'video' ? site.birthVideo : site.birth.details?.photo;
      if (!media || media.key !== key || !isSiteMediaKey(site, key)) {
        return null;
      }
      const object = await store.get(key, request);
      return object ? mediaResponse(object, 'private, no-store') : null;
    },
  };
}
