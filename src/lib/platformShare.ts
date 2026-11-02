import type { Metadata } from 'next';
import { platformCopy } from './copy/platform.ts';
import type { Lang } from './i18n.ts';

/**
 * How a Platform link looks when shared. Text and image speak the same
 * language, negotiated for whoever asks (platformLang), so each language has
 * its own image file in `public/og/`, copied there by `npm run brand`.
 */

export const PLATFORM_SHARE_PAGES = ['marketing', 'dashboard'] as const;

export type PlatformSharePage = (typeof PLATFORM_SHARE_PAGES)[number];

/** The size in pixels of the images `scripts/brand-kit.mjs` draws. */
export const PLATFORM_SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

export function platformShareImagePath(page: PlatformSharePage, lang: Lang): string {
  return `/og/${page}-${lang}.png`;
}

export function platformShareImage(page: PlatformSharePage, lang: Lang) {
  const alt = platformCopy[lang].meta.imageAlt[page];
  return { url: platformShareImagePath(page, lang), type: 'image/png', ...PLATFORM_SHARE_IMAGE_SIZE, alt };
}

/**
 * The `openGraph` and `twitter` fields of a Platform page's metadata. A route
 * segment that sets either replaces the parent's whole field, so every field
 * the preview needs is here.
 */
export function platformShareMeta(page: PlatformSharePage, lang: Lang): Pick<Metadata, 'openGraph' | 'twitter'> {
  const image = platformShareImage(page, lang);
  const { description } = platformCopy[lang].meta;
  return {
    openGraph: { siteName: 'Loading Baby', type: 'website', description, images: [image] },
    twitter: { card: 'summary_large_image', images: [image] },
  };
}
