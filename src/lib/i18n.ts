/**
 * Language negotiation, shared by the layout and the page. Pure and free of any
 * Next import so it can be unit tested with the plain node runner.
 */

export type Lang = 'it' | 'en';

export const LANGS: readonly Lang[] = ['it', 'en'];

/** Written by the client when the visitor picks a language by hand. */
export const LANG_COOKIE = 'lang';

/** A language's name in English, for the Dashboard: "Italian". Any language Intl knows has one. */
export function englishName(lang: Lang): string {
  return new Intl.DisplayNames('en', { type: 'language' }).of(lang) ?? lang;
}

export function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}

/**
 * The Visitor's language among `offered`, a Site's Languages with the main
 * one first. An explicit choice always beats the browser preference, so the
 * cookie is checked first. Otherwise the Accept-Language entries are ranked
 * by their q weight and the first offered one wins; with no match, the main
 * Language does.
 */
export function negotiateLang(
  acceptLanguage: string | null | undefined,
  cookie: string | null | undefined,
  offered: readonly Lang[]
): Lang {
  if (isLang(cookie) && offered.includes(cookie)) {
    return cookie;
  }
  if (!acceptLanguage) {
    return offered[0];
  }

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q === undefined ? 1 : Number(q.slice(2));
      return {
        primary: tag.trim().toLowerCase().split('-')[0],
        weight: Number.isFinite(weight) ? weight : 0,
      };
    })
    .filter((entry) => entry.primary !== '' && entry.weight > 0)
    // Array.prototype.sort is stable, so entries with the same weight keep the
    // order in which the browser declared them.
    .sort((a, b) => b.weight - a.weight);

  for (const entry of ranked) {
    if (isLang(entry.primary) && offered.includes(entry.primary)) {
      return entry.primary;
    }
  }
  return offered[0];
}
