import { TZDate } from '@date-fns/tz';
import { addDays, format, startOfDay } from 'date-fns';
import { fallbackLang, isLang, type Lang } from './i18n.ts';
import { publicPageView } from './publicPageView.ts';
import type { SiteSettings } from './siteSettings.ts';

/**
 * How a Site looks outside its Public page: the Site icon in a browser tab and
 * on a home screen, and the share image, title and description of its link
 * previews. Pure, so the routes that draw the images, the Public page's
 * metadata and the editor's previews all agree. Each speaks one of the Site's
 * Languages, negotiated for whoever asks as the Public page is (requestLang):
 * WhatsApp asks from the sender's phone, in its language; a server that names
 * none gets the fallback Language.
 */

/** Every image a Site icon is drawn as, with its size in pixels. */
export const SITE_ICON_VARIANTS = {
  favicon: { size: 32, maskable: false },
  apple: { size: 180, maskable: false },
  '192': { size: 192, maskable: false },
  '512': { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
} as const;

export type SiteIconVariant = keyof typeof SITE_ICON_VARIANTS;

export function isSiteIconVariant(value: string): value is SiteIconVariant {
  return Object.hasOwn(SITE_ICON_VARIANTS, value);
}

/** The loading baby: the Platform's own files, which a Site's subdomain serves too (see proxy.ts). */
const LOADING_BABY: Record<SiteIconVariant, string> = {
  favicon: '/favicon.ico',
  apple: '/apple-icon.png',
  '192': '/icon-192.png',
  '512': '/icon-512.png',
  maskable: '/icon-maskable-512.png',
};

/** Where a Site's icons, manifest and share image are served, relative to its Address. */
export const SITE_PATHS = {
  icon: (variant: SiteIconVariant) => `/site-icon/${variant}`,
  manifest: '/manifest.webmanifest',
  shareImage: '/share-image',
} as const;

/**
 * The URL of one image of the Site icon. An emoji's is generated, and its query
 * changes with the emoji and the Palette, so each version can be cached for good.
 */
export function siteIconUrl(settings: Pick<SiteSettings, 'icon' | 'theme'>, variant: SiteIconVariant, address: string) {
  if (!settings.icon) {
    return LOADING_BABY[variant];
  }
  const codepoints = Array.from(settings.icon, (char) => char.codePointAt(0)?.toString(16)).join('-');
  return `${address}${SITE_PATHS.icon(variant)}?v=${codepoints}.${settings.theme.palette}`;
}

/** A link preview's title and description: the Public page's headline and Countdown, in `lang`. */
export function shareText(
  settings: SiteSettings,
  lang: Lang,
  now: Date = new Date()
): { title: string; description: string } {
  const view = publicPageView(settings, lang, now);
  const { waiting, born } = view;
  let description = view.tagline;
  if (born) {
    description = born.bornOn;
  } else if (waiting) {
    description = [waiting.count === null ? waiting.unit : `${waiting.count} ${waiting.unit}`, waiting.dueDate].join(
      ' · '
    );
  }
  return { title: view.title, description };
}

/** The Language a share image named in its URL speaks: one of the Site's, else its fallback Language. */
export function shareImageLang(requested: string | null, languages: readonly Lang[]): Lang {
  return isLang(requested) && languages.includes(requested) ? requested : fallbackLang(languages);
}

/** Today in the Site's Timezone, as the share image's URL carries it so link previews refresh daily. */
export function shareImageDay(timezone: string, now: Date = new Date()): string {
  return format(new TZDate(now, timezone), 'yyyy-MM-dd');
}

/** Seconds from `now` to the next midnight in `timezone`, when the Countdown, and so the share image, changes. */
export function secondsUntilMidnight(timezone: string, now: Date = new Date()): number {
  const midnight = startOfDay(addDays(new TZDate(now, timezone), 1));
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 1000));
}
