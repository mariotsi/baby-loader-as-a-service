import type { AppEnv } from './appEnv.ts';
import type { BirthMedia } from './siteSettings.ts';

export type BirthMediaKind = 'photo' | 'video';

/**
 * Whether media is served from the page's own origin. A Preview lives on
 * `workers.dev`, another site than its media domain, which sits behind
 * Cloudflare Access: the browser does not send the Access cookie to it from
 * there, so an image from it breaks; the page's origin serves the same file
 * from the same bucket. Staging and its media domain share one Access
 * application that sets the cookie on both at sign-in, so staging uses the
 * media domain like production.
 */
export function mediaFromPageOrigin(appEnv: AppEnv): boolean {
  return appEnv === 'preview';
}

export function birthMediaUrl(slug: string, kind: BirthMediaKind, media: BirthMedia, appEnv: AppEnv): string {
  return mediaFromPageOrigin(appEnv) ? birthMediaPreviewPath(slug, kind, media.key) : media.url;
}

export function birthMediaPreviewPath(slug: string, kind: BirthMediaKind, key: string): string {
  return `/api/sites/${encodeURIComponent(slug)}/birth-media/${kind}?key=${encodeURIComponent(key)}`;
}
