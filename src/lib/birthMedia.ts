import type { AppEnv } from './appEnv.ts';
import type { BirthMediaKind } from './siteMedia.ts';
import type { BirthMedia } from './siteSettings.ts';

export type { BirthMediaKind };

/**
 * Whether media is served from the page's own origin. A Preview lives on
 * `workers.dev`, another site than its media domain, which sits behind
 * Cloudflare Access: the browser does not send the Access cookie to it from
 * there, so an image from it breaks; the page's origin serves the same file
 * from the same bucket. Staging and its media domain share one Access
 * application that sets the cookie on both at sign-in, so staging uses the
 * media domain like production. Development stores media in its local
 * bucket, which no media domain serves.
 */
export function mediaFromPageOrigin(appEnv: AppEnv): boolean {
  return appEnv === 'preview' || appEnv === 'development';
}

export function birthMediaUrl(slug: string, kind: BirthMediaKind, media: BirthMedia, appEnv: AppEnv): string {
  return mediaFromPageOrigin(appEnv) ? birthMediaPreviewPath(slug, kind, media.key) : media.url;
}

export function birthMediaPreviewPath(slug: string, kind: BirthMediaKind, key: string): string {
  return `/api/sites/${encodeURIComponent(slug)}/birth-media/${kind}?key=${encodeURIComponent(key)}`;
}
