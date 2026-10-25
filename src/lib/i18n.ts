/**
 * Language negotiation, shared by the layout and the page. Pure and free of any
 * Next import so it can be unit tested with the plain node runner.
 */

export type Lang = 'it' | 'en';

export const LANGS: readonly Lang[] = ['it', 'en'];

/** Written by the client when the visitor picks a language by hand. */
export const LANG_COOKIE = 'lang';

/**
 * The order a Site's Languages are tried in when a Visitor's browser speaks
 * none of them: English, the one most Visitors are likeliest to read, then
 * Italian. Every language in LANGS has a place here.
 */
export const FALLBACK_LANGS: readonly Lang[] = ['en', 'it'];

/** The Language a Visitor gets from `offered`, a Site's Languages, when nothing they ask for is among them. */
export function fallbackLang(offered: readonly Lang[]): Lang {
  return FALLBACK_LANGS.find((lang) => offered.includes(lang)) ?? offered[0];
}

/** A Site's Languages in the order the Platform lists every language, whatever order they are stored in. */
export function inPlatformOrder(languages: readonly Lang[]): Lang[] {
  return LANGS.filter((lang) => languages.includes(lang));
}

/** A language's name in English, for the Dashboard: "Italian". Any language Intl knows has one. */
export function englishName(lang: Lang): string {
  return languageName(lang, 'en');
}

/** A language's name as `inLang` writes it mid-sentence: "Italian" in English, "inglese" in Italian. */
export function languageName(lang: string, inLang: Lang): string {
  return new Intl.DisplayNames(inLang, { type: 'language' }).of(lang) ?? lang;
}

/** A count's words in every plural form a language has; `other` is the one every language has. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * The words for `n` in `lang`, picked by the language's own plural rules: 1
 * is `one` in English and Italian, while other languages also have `few` or
 * `many`. A form a dictionary leaves out falls back to `other`.
 */
export function plural(lang: Lang, n: number, forms: PluralForms): string {
  return forms[new Intl.PluralRules(lang).select(n)] ?? forms.other;
}

export function isLang(value: unknown): value is Lang {
  return LANGS.includes(value as Lang);
}

/**
 * The Visitor's language among `offered`, a Site's Languages. An explicit
 * choice always beats the browser preference, so the cookie is checked
 * first. Otherwise the Accept-Language entries are ranked by their q weight
 * and the first offered one wins; with no match, the fallback does (see
 * FALLBACK_LANGS).
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
    return fallbackLang(offered);
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
  return fallbackLang(offered);
}
