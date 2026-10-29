import type { Lang } from './i18n.ts';
import type { SiteSettings } from './siteSettings.ts';

/** What a home screen writes under the Site icon: the Page name in `lang`, else the baby's name where the page shows it. */
export function siteShortName(settings: Pick<SiteSettings, 'babyName' | 'birth' | 'privacy' | 'pageName'>, lang: Lang) {
  const pageName = settings.pageName[lang]?.trim();
  if (pageName) {
    return pageName;
  }
  const nameShown = settings.birth.born || settings.privacy.showName;
  return nameShown && settings.babyName ? settings.babyName : 'Loading Baby';
}

/**
 * The Twemoji image ImageResponse draws for `emoji`, so the editor's previews
 * show the very picture the generated images carry. A variation selector is
 * dropped unless the emoji is a joined sequence, as ImageResponse does.
 */
export function twemojiUrl(emoji: string): string {
  const code = emoji.includes('\u200d') ? emoji : emoji.replaceAll('\ufe0f', '');
  const codepoints = Array.from(code, (char) => char.codePointAt(0)?.toString(16)).join('-');
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoints}.svg`;
}
