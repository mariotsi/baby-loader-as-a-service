import type { AppEnv } from './appEnv.ts';
import type { BirthMedia } from './siteSettings.ts';

export type BirthMediaKind = 'photo' | 'video';

/**
 * Whether media is served from the page's own origin. On staging and its
 * Previews the media domain sits behind Cloudflare Access too, and a browser
 * signed in to the page is not always signed in to it, so an image from it
 * breaks; the page's origin serves the same file from the same bucket.
 */
export function mediaFromPageOrigin(appEnv: AppEnv): boolean {
  return appEnv === 'staging' || appEnv === 'preview';
}

export function birthMediaUrl(slug: string, kind: BirthMediaKind, media: BirthMedia, appEnv: AppEnv): string {
  return mediaFromPageOrigin(appEnv) ? birthMediaPreviewPath(slug, kind, media.key) : media.url;
}

export function birthMediaPreviewPath(slug: string, kind: BirthMediaKind, key: string): string {
  return `/api/sites/${encodeURIComponent(slug)}/birth-media/${kind}?key=${encodeURIComponent(key)}`;
}
