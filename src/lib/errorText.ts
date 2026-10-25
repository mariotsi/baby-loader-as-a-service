import { type ErrorsCopy, errorsCopy } from './copy/errors.ts';
import { isLang, type Lang, languageName } from './i18n.ts';
import type { RouteError } from './routeError.ts';
import type { SiteSettingsError } from './siteSettings.ts';

/**
 * Turns the codes routes and the Site settings module answer with into words
 * in the page's language, from the errors dictionary (`copy/errors.ts`).
 */

/** The words for a route's `error`, or the generic ones for anything that is not a known code. */
export function routeErrorText(error: unknown, lang: Lang): string {
  const t = errorsCopy[lang];
  const code = (error as RouteError | undefined)?.code;
  const text = typeof code === 'string' && Object.hasOwn(t.route, code) ? t.route[code] : undefined;
  if (typeof text === 'function') {
    return text((error as RouteError).params?.max ?? 0);
  }
  return text ?? t.generic;
}

/** The words for a failed response's body: its Site settings errors, else its route error. */
export function responseErrorText(body: unknown, lang: Lang): string {
  const errors = (body as { errors?: SiteSettingsError[] } | null)?.errors;
  return errors
    ? describeSiteSettingsErrors(errors, lang)
    : routeErrorText((body as { error?: unknown } | null)?.error, lang);
}

export function describeSiteSettingsErrors(errors: SiteSettingsError[], lang: Lang): string {
  const t = errorsCopy[lang];
  return errors.map((error) => t.sentence(fieldLabel(error.path, lang), problem(error, t))).join(' ');
}

/**
 * Whether the editor shows the error at `path` next to its field: a
 * Milestone's, or the Birth message's or Page name's in one Language. Every
 * other error goes in the form's status message.
 */
export function isInlineError(path: string): boolean {
  return /^(milestones\.\d+|birth\.details\.message|pageName)\./.test(path);
}

/**
 * The words under a field for one of its errors, telling how to fix it.
 * `languages` are the Site's: with more than one, an error on a text in one
 * Language names that Language.
 */
export function inlineErrorText(
  { path, code, params }: SiteSettingsError,
  languages: readonly Lang[],
  lang: Lang
): string {
  const t = errorsCopy[lang].inline;
  const language = /\.([a-z]+)$/.exec(path)?.[1];
  const named = languages.length > 1 && language && isLang(language) ? languageName(language, lang) : null;
  if (/^milestones\.\d+\.label\./.test(path) && code === 'required') {
    return named ? t.milestoneIn(named) : t.milestoneLabel;
  }
  if (/^milestones\.\d+\.emoji$/.test(path)) {
    return t.pickEmoji;
  }
  if (/^milestones\.\d+\.place$/.test(path) && code === 'invalidOption') {
    return t.pickPlace;
  }
  if (/^milestones\.\d+\.date$/.test(path)) {
    return code === 'required' ? t.pickDay : t.noSuchDay;
  }
  if (code === 'tooLong') {
    return t.keepTo(params?.max ?? '');
  }
  return describeSiteSettingsErrors([{ path, code, params }], lang);
}

/** " (Italian)" after the name of a text written in one Language. */
function inLanguage(code: string, lang: Lang): string {
  return ` (${languageName(code, lang)})`;
}

/** "Milestone 2 label (Italian)", or null when `field` is not a Milestone's. */
function milestoneLabel(field: string, lang: Lang): string | null {
  const t = errorsCopy[lang];
  const place = /^milestones\.(\d+)\.place(?:\.([a-z]+))?$/.exec(field);
  if (place) {
    return t.milestone(Number(place[1]) + 1, `${t.milestoneParts.place}${place[2] ? ` ${place[2]}` : ''}`);
  }
  const milestone = /^milestones\.(\d+)\.(emoji|label|date)(?:\.([a-z]+))?$/.exec(field);
  if (!milestone) {
    return null;
  }
  const [, index, part, code] = milestone;
  return t.milestone(Number(index) + 1, `${t.milestoneParts[part]}${code ? inLanguage(code, lang) : ''}`);
}

function fieldLabel(path: string, lang: Lang): string {
  const t = errorsCopy[lang];
  const field = path.replace(/^settings\./, '');
  const notification = /^messages\.[a-z]+\.(title|body)$/.exec(field);
  if (notification) {
    return notification[1] === 'title' ? t.notificationTitle : t.message;
  }
  const perLanguage = /^(birth\.details\.message|pageName)\.([a-z]+)$/.exec(field);
  if (perLanguage) {
    return `${perLanguage[1] === 'pageName' ? t.fields.pageName : t.message}${inLanguage(perLanguage[2], lang)}`;
  }
  if (/^languages\.\d+$/.test(field)) {
    return t.fields.languages;
  }
  return milestoneLabel(field, lang) ?? t.fields[field] ?? field;
}

function problem({ code, params, path }: SiteSettingsError, { problems: t }: ErrorsCopy): string {
  switch (code) {
    case 'required':
      return t.required;
    case 'tooLong':
      return path.endsWith('milestones') ? t.tooManyItems(params?.max ?? '') : t.tooManyChars(params?.max ?? '');
    case 'outOfRange':
      if (params?.min !== undefined && params?.max !== undefined) {
        return t.between(params.min, params.max);
      }
      return params?.max !== undefined ? t.atMost(params.max) : t.atLeast(params?.min ?? '');
    case 'invalidDate':
      return t.invalidDate;
    case 'inFuture':
      return t.inFuture;
    case 'invalidOption':
      return t.invalidOption;
    case 'invalidFormat':
      return path.endsWith('emoji') ? t.singleEmoji : t.slugFormat;
    case 'unknownField':
      return t.unknownField;
    case 'slugTaken':
      return t.slugTaken;
    case 'slugReserved':
      return t.slugReserved;
    case 'invalidType':
      return path.endsWith('weightGrams') ? t.wholeGrams : t.wrongType;
  }
}
