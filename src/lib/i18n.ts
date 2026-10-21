/**
 * Language negotiation, shared by the layout and the page. Pure and free of any
 * Next import so it can be unit tested with the plain node runner.
 */

export type Lang = 'it' | 'en';

export const LANGS: readonly Lang[] = ['it', 'en'];

export const DEFAULT_LANG: Lang = 'en';

/** Written by the client when the visitor picks a language by hand. */
export const LANG_COOKIE = 'lang';

export function isLang(value: unknown): value is Lang {
  return value === 'it' || value === 'en';
}

/**
 * An explicit choice always beats the browser preference, so the cookie is
 * checked first. Otherwise the Accept-Language entries are ranked by their q
 * weight and the first supported one wins.
 */
export function negotiateLang(acceptLanguage: string | null | undefined, cookie?: string | null): Lang {
  if (isLang(cookie)) {
    return cookie;
  }
  if (!acceptLanguage) {
    return DEFAULT_LANG;
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
    .sort((a, b) => b.weight - a.weight);

  for (const entry of ranked) {
    if (isLang(entry.primary)) {
      return entry.primary;
    }
  }
  return DEFAULT_LANG;
}
