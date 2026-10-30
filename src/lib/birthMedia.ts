import type { AppEnv } from './appEnv.ts';
import type { BirthMedia } from './siteSettings.ts';

export type BirthMediaKind = 'photo' | 'video';

/** Preview media stays on the page's Access-authenticated origin. */
export function birthMediaUrl(slug: string, kind: BirthMediaKind, media: BirthMedia, appEnv: AppEnv): string {
  return appEnv === 'preview' ? birthMediaPreviewPath(slug, kind, media.key) : media.url;
}

export function birthMediaPreviewPath(slug: string, kind: BirthMediaKind, key: string): string {
  return `/api/sites/${encodeURIComponent(slug)}/birth-media/${kind}?key=${encodeURIComponent(key)}`;
}
