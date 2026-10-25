import type { Lang } from '../i18n.ts';

/** Copy that Public pages and Platform pages share, like the Language switcher's. */
const en = {
  /** The language's name in itself, so a reader finds their own whichever language the page is in. */
  languageName: 'English',
  /** Names the Language switcher for screen readers. */
  languageLabel: 'Language',
};

export type CommonCopy = typeof en;

const it: CommonCopy = {
  languageName: 'Italiano',
  languageLabel: 'Lingua',
};

export const commonCopy: Record<Lang, CommonCopy> = { it, en };
