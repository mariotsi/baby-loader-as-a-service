import * as z from 'zod/mini';
import type { AppEnv } from './appEnv.ts';
import type { BirthMediaKind } from './siteMedia.ts';
import type { BirthMedia } from './siteSettings.ts';

export type { BirthMediaKind };

/**
 * Where a page loads a picture or a video from: a stored file on its media
 * domain (https), a path on the page's own origin, or a `blob:` URL for a
 * file the Owner picked and has not saved yet.
 */
export const mediaUrlSchema = z
  .string()
  .check(
    z.refine(
      (url) => /^https:\/\/[^/]/.test(url) || /^\/(?!\/)/.test(url) || url.startsWith('blob:'),
      'must be an https URL, a path on the page origin or a blob: URL'
    )
  )
  .brand<'MediaUrl'>();
export type MediaUrl = z.output<typeof mediaUrlSchema>;
export function isMediaUrl(value: unknown): value is MediaUrl {
  return mediaUrlSchema.safeParse(value).success;
}

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

export function birthMediaUrl(slug: string, kind: BirthMediaKind, media: BirthMedia, appEnv: AppEnv): MediaUrl {
  return mediaUrlSchema.parse(mediaFromPageOrigin(appEnv) ? birthMediaPreviewPath(slug, kind, media.key) : media.url);
}

export function birthMediaPreviewPath(slug: string, kind: BirthMediaKind, key: string): string {
  return `/api/sites/${encodeURIComponent(slug)}/birth-media/${kind}?key=${encodeURIComponent(key)}`;
}
