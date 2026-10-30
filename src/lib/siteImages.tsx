import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import { ShareCard } from '@/components/ShareCard';
import type { Lang } from './i18n.ts';
import { publicPageView } from './publicPageView.ts';
import { SITE_ICON_VARIANTS, type SiteIconVariant } from './siteMeta.ts';
import type { SiteSettings } from './siteSettings.ts';
import { getFont, getPalette, type Typeface } from './theme.ts';

/**
 * Draws a Site's emoji icon and its share image. Emoji come from Twemoji, the
 * same set the editor's previews show, so neither matches the emoji font of
 * the phone that opens the page.
 */

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** A maskable icon keeps its emoji inside the central 80% circle that Android's masks never crop. */
export function siteIconImage(
  settings: Pick<SiteSettings, 'icon' | 'theme'>,
  variant: SiteIconVariant,
  headers: HeadersInit
) {
  const { size, maskable } = SITE_ICON_VARIANTS[variant];
  const vars = getPalette(settings.theme.palette).vars;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: vars['--color-bg'],
        fontSize: size * (maskable ? 0.5 : 0.7),
      }}
    >
      {settings.icon}
    </div>,
    { width: size, height: size, emoji: 'twemoji', headers }
  );
}

const loadingBabyMarks: Partial<Record<LoadingBabyMark, Promise<string | null>>> = {};

type LoadingBabyMark = 'mark.png' | 'mark-on-dark.png';

/**
 * The loading baby's mark (a brand kit copy in `public/`) as a data URL, read
 * once. A Worker has no `public/` on disk, so it asks its static assets;
 * `next dev` has no built assets, so it reads the file. Null when neither
 * answers: the image then goes without it rather than failing, which would
 * leave link previews with no image at all.
 */
function loadingBaby(file: LoadingBabyMark): Promise<string | null> {
  loadingBabyMarks[file] ??= (async () => {
    const assets = await getCloudflareContext({ async: true })
      .then(({ env }) => env.ASSETS)
      .catch(() => undefined);
    const response = await assets?.fetch(`https://assets.local/${file}`).catch(() => undefined);
    const png = response?.ok
      ? Buffer.from(await response.arrayBuffer())
      : await readFile(join(process.cwd(), 'public', file)).catch(() => null);
    return png && `data:image/png;base64,${png.toString('base64')}`;
  })();
  return loadingBabyMarks[file];
}

/** The share image: the Site icon beside the Public page's headline and Countdown, in its Palette and Font. */
export async function shareImage(settings: SiteSettings, address: string, lang: Lang, now: Date, headers: HeadersInit) {
  const view = publicPageView(settings, lang, now);
  const vars = getPalette(settings.theme.palette).vars;
  const font = getFont(settings.theme.font);
  const lines = [
    view.tagline,
    view.title,
    view.sex ?? '',
    view.waiting ? `${view.waiting.count ?? ''} ${view.waiting.unit} ${view.waiting.dueDate}` : '',
    view.born?.bornOn ?? '',
    address,
  ];
  const text = lines.join('');
  // The body face is loaded on its own even when it shares the display's family, so body text keeps its own weight;
  // the Address pill is the body face in bold.
  const fonts = (
    await Promise.all([
      googleFont(font.display, text, 'display'),
      googleFont(font.body, text, 'body'),
      googleFont({ ...font.body, weight: 700 }, address, 'body'),
    ])
  ).filter((loaded) => loaded !== null);
  const display = fonts.some((f) => f.name === 'display') ? 'display' : undefined;
  const body = fonts.some((f) => f.name === 'body') ? 'body' : display;

  let icon: ReactNode = <span style={{ fontSize: 230 }}>{settings.icon}</span>;
  if (!settings.icon) {
    const baby = await loadingBaby(vars['--color-scheme'] === 'dark' ? 'mark-on-dark.png' : 'mark.png');
    // biome-ignore lint/performance/noImgElement: ImageResponse draws plain elements, never next/image.
    icon = baby && <img src={baby} width={260} height={260} alt="" />;
  }
  return new ImageResponse(
    <ShareCard
      view={view}
      address={address}
      icon={icon}
      px={(pixels) => pixels}
      color={(token) => vars[token]}
      font={{ display, displayWeight: font.display.weight, body, bodyWeight: font.body.weight }}
    />,
    { ...SHARE_IMAGE_SIZE, emoji: 'twemoji', fonts, headers }
  );
}

/**
 * One face of a Font as a TrueType file, limited to the characters of `text`.
 * Google Fonts sends TrueType to a client that asks without a browser's user
 * agent. Null when it cannot be fetched: the image then falls back to the
 * typeface ImageResponse bundles.
 */
async function googleFont(face: Typeface, text: string, name: 'display' | 'body') {
  const family = /'([^']+)'/.exec(face.cssStack)?.[1];
  if (!family) {
    return null;
  }
  try {
    const query = `family=${family.replaceAll(' ', '+')}:wght@${face.weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`)).text();
    const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
    if (!url) {
      return null;
    }
    const data = await (await fetch(url)).arrayBuffer();
    return { name, data, weight: face.weight as 400, style: 'normal' as const };
  } catch {
    return null;
  }
}
