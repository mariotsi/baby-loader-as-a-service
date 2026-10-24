import { addMonths, format, isAfter, isMatch, isValid, parseISO } from 'date-fns';
import * as z from 'zod/mini';
import { slugProblem } from './address.ts';
import { LANGS, type Lang } from './i18n.ts';
import { DEFAULT_FONT, DEFAULT_PALETTE, FONTS, PALETTES } from './theme.ts';

/**
 * Every rule about Site settings (see GLOSSARY.md). Free of server imports,
 * so the editor runs the same parse in the browser that the server runs on
 * every write. Routes pass the raw request body and never touch the schema.
 */

export type SiteSettingsErrorCode =
  | 'required'
  | 'invalidType'
  | 'invalidFormat'
  | 'invalidOption'
  | 'invalidDate'
  | 'tooLong'
  | 'outOfRange'
  | 'inFuture'
  | 'unknownField'
  | 'slugTaken'
  | 'slugReserved';

/** One rejected field. `path` is dot-separated (`birth.details.weightGrams`, `milestones.2.label.it`). */
export interface SiteSettingsError {
  path: string;
  code: SiteSettingsErrorCode;
  params?: { min?: number | string; max?: number | string };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: SiteSettingsError[] };

const DAY_FORMAT = 'yyyy-MM-dd';
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DUE_DATE_WINDOW_MONTHS = 10;

/** The regexes pin the exact shape; date-fns rejects days that do not exist, such as 2027-02-30. */
function isCalendarDate(value: string): boolean {
  return CALENDAR_DATE.test(value) && isMatch(value, DAY_FORMAT);
}

function isIsoDatetime(value: string): boolean {
  return ISO_DATETIME.test(value) && isValid(parseISO(value));
}

/** Any IANA name `Intl` knows, aliases included: browsers report some zones by an older alias (Europe/Kiev). */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return value !== '';
  } catch {
    return false;
  }
}

/**
 * A string that must be filled in and follow `rule`. An empty one is a
 * missing one, reported as `required` and not also as breaking the rule.
 * Never `abort: true` instead: an aborted parse skips the label check on
 * siteSettingsSchema, and a save would hide the missing labels.
 */
function requiredString(rule: (value: string) => boolean, code: SiteSettingsErrorCode) {
  return z.string().check(
    z.minLength(1),
    z.refine((value) => value === '' || rule(value), { params: { code } })
  );
}

const calendarDate = requiredString(isCalendarDate, 'invalidDate');
const isoDatetime = requiredString(isIsoDatetime, 'invalidDate');
const lang = z.enum(LANGS as readonly Lang[] as [Lang, ...Lang[]]);

/**
 * One text per Language, like a Milestone's label. A text in a Language the
 * Site no longer speaks is kept, so ticking the Language again brings it back.
 */
const textPerLanguage = (max: number) => z.partialRecord(lang, z.string().check(z.trim(), z.maxLength(max)));

/** Exactly one emoji, skin tone and joined sequences included. */
// biome-ignore lint/complexity/useRegexLiterals: TypeScript refuses a literal `v` flag below an ES2024 target.
const ONE_EMOJI = new RegExp('^\\p{RGI_Emoji}$', 'v');
const emoji = requiredString((value) => ONE_EMOJI.test(value), 'invalidFormat');

/** What a new Milestone starts with, until the Owner picks its own emoji. */
export const DEFAULT_MILESTONE_EMOJI = '✨';

const birthSchema = z.discriminatedUnion('born', [
  z.strictObject({ born: z.literal(false), details: z.null() }),
  z.strictObject({
    born: z.literal(true),
    details: z.strictObject({
      datetime: isoDatetime,
      weightGrams: z.nullable(z.int().check(z.minimum(300), z.maximum(8000))),
      lengthCm: z.nullable(z.number().check(z.minimum(20), z.maximum(70))),
      // Optional, so only the Languages that have one.
      message: textPerLanguage(1000),
    }),
  }),
]);

const siteSettingsSchema = z
  .strictObject({
    babyName: z.string().check(z.trim(), z.maxLength(60)),
    sex: z.enum(['female', 'male', 'unknown']),
    dueDate: z.nullable(calendarDate),
    birth: birthSchema,
    milestones: z
      .array(z.strictObject({ emoji, label: textPerLanguage(80), date: calendarDate }))
      .check(z.maxLength(50)),
    /** The Languages the Public page speaks, in any order: pages list them in the Platform's (see inPlatformOrder). */
    languages: z.array(lang).check(
      z.minLength(1),
      z.refine((langs) => new Set(langs).size === langs.length, { params: { code: 'invalidOption' } })
    ),
    timezone: z.string().check(z.refine(isTimeZone, { params: { code: 'invalidOption' } })),
    theme: z.strictObject({
      palette: z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]),
      font: z.enum(FONTS.map((f) => f.id) as [string, ...string[]]),
    }),
    privacy: z.strictObject({ showName: z.boolean(), showSex: z.boolean() }),
    /** The Owner's line in the Public page's header, one per language that has one, kept for a language the Site no longer speaks. */
    pageName: textPerLanguage(60),
  })
  .check(
    z.superRefine(
      (settings, ctx) => {
        settings.milestones.forEach((milestone, i) => {
          for (const missing of missingLanguages(milestone.label, settings.languages)) {
            ctx.addIssue({ code: 'custom', path: ['milestones', i, 'label', missing], params: { code: 'required' } });
          }
        });
      },
      // Runs beside the other fields' errors, so one save reports every missing label. Zod leaves an issue's path
      // unset at the root.
      { when: ({ issues }) => !issues.some(({ path = [] }) => hidesLabels(path)) }
    )
  );

/** Whether an issue at `path` leaves the Languages, or which labels a Milestone has, unknown. */
function hidesLabels(path: readonly PropertyKey[]): boolean {
  const [field, , key] = path;
  return (
    path.length === 0 ||
    field === 'languages' ||
    (field === 'milestones' && (path.length <= 2 || (path.length === 3 && key === 'label')))
  );
}

/** The Languages among `languages` that `text` has nothing written in, in the order given. */
export function missingLanguages(text: Partial<Record<Lang, string>>, languages: readonly Lang[]): Lang[] {
  return languages.filter((language) => !text[language]?.trim());
}

const newSiteSchema = z.strictObject({
  slug: z.string().check(
    z.trim(),
    z.toLowerCase(),
    z.refine((slug) => slugProblem(slug) !== 'invalidFormat', { params: { code: 'invalidFormat' } }),
    z.refine((slug) => slugProblem(slug) !== 'slugReserved', { params: { code: 'slugReserved' } })
  ),
  settings: siteSettingsSchema,
});

/** What the editor holds and sends: every field is required. */
export type SiteSettingsInput = z.input<typeof siteSettingsSchema>;
export type SiteSettings = z.output<typeof siteSettingsSchema>;
export type Birth = SiteSettings['birth'];
export type BirthDetails = Extract<Birth, { born: true }>['details'];
export type Milestone = SiteSettings['milestones'][number];
export type PageName = SiteSettings['pageName'];
export type TextPerLanguage = Milestone['label'];

declare const validSettings: unique symbol;
declare const validNewSite: unique symbol;

/** Site settings that passed every rule. Only parseSiteSettings and parseNewSite produce one. */
export type ValidSiteSettings = SiteSettings & { readonly [validSettings]: true };

/** A Slug and Site settings that passed every rule. Only parseNewSite produces one. */
export type ValidNewSite = {
  readonly slug: string;
  readonly settings: ValidSiteSettings;
  readonly [validNewSite]: true;
};

/** Where onboarding and the editor start from. */
export const defaultSiteSettings: SiteSettingsInput = {
  babyName: '',
  sex: 'unknown',
  dueDate: null,
  birth: { born: false, details: null },
  milestones: [],
  languages: ['en'],
  timezone: 'Europe/Rome',
  theme: { palette: DEFAULT_PALETTE, font: DEFAULT_FONT },
  privacy: { showName: true, showSex: true },
  pageName: {},
};

/**
 * The title of a Notification sent without one: the baby's name, which
 * Privacy settings hide only in the Waiting state. Undefined leaves the
 * service worker's generic title.
 */
export function defaultNotificationTitle(
  settings: Pick<SiteSettings, 'babyName' | 'birth' | 'privacy'>
): string | undefined {
  const nameShown = settings.birth.born || settings.privacy.showName;
  return nameShown && settings.babyName ? settings.babyName : undefined;
}

/** The value at `path` in the raw input, to tell a missing field from one of the wrong type. */
function rawAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let value: unknown = input;
  for (const key of path) {
    if (value === null || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<PropertyKey, unknown>)[key];
  }
  return value;
}

function toErrors(issues: readonly z.core.$ZodIssue[], input: unknown): SiteSettingsError[] {
  return issues.flatMap((issue): SiteSettingsError[] => {
    const path = issue.path.join('.');
    switch (issue.code) {
      case 'unrecognized_keys':
        return issue.keys.map((key) => ({ path: [...issue.path, key].join('.'), code: 'unknownField' }));
      case 'invalid_type':
      case 'invalid_union': {
        const raw = rawAt(input, issue.path);
        return [{ path, code: raw === undefined || raw === null ? 'required' : 'invalidType' }];
      }
      case 'too_big':
        return [
          { path, code: issue.origin === 'number' ? 'outOfRange' : 'tooLong', params: { max: Number(issue.maximum) } },
        ];
      case 'too_small':
        return issue.origin === 'number'
          ? [{ path, code: 'outOfRange', params: { min: Number(issue.minimum) } }]
          : [{ path, code: 'required' }];
      case 'invalid_value':
        return [{ path, code: 'invalidOption' }];
      case 'invalid_format':
        return [{ path, code: 'invalidFormat' }];
      case 'custom':
        return [{ path, code: (issue.params?.code as SiteSettingsErrorCode | undefined) ?? 'invalidType' }];
      default:
        return [{ path, code: 'invalidType' }];
    }
  });
}

/** Rules that span fields or depend on the current time; they run once every field is valid. */
function crossFieldErrors(settings: SiteSettings, now: Date): SiteSettingsError[] {
  const errors: SiteSettingsError[] = [];
  if (settings.dueDate) {
    // Days compare as yyyy-MM-dd strings; addMonths clamps to the month's last day.
    const min = format(addMonths(now, -DUE_DATE_WINDOW_MONTHS), DAY_FORMAT);
    const max = format(addMonths(now, DUE_DATE_WINDOW_MONTHS), DAY_FORMAT);
    if (settings.dueDate < min || settings.dueDate > max) {
      errors.push({ path: 'dueDate', code: 'outOfRange', params: { min, max } });
    }
  }
  if (settings.birth.born) {
    // Sex is required in the Born state even when Privacy settings hide it.
    if (!settings.babyName) {
      errors.push({ path: 'babyName', code: 'required' });
    }
    if (settings.sex === 'unknown') {
      errors.push({ path: 'sex', code: 'required' });
    }
    if (isAfter(parseISO(settings.birth.details.datetime), now)) {
      errors.push({ path: 'birth.details.datetime', code: 'inFuture' });
    }
  }
  return errors;
}

export function parseSiteSettings(input: unknown, now: Date = new Date()): ParseResult<ValidSiteSettings> {
  const result = siteSettingsSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: toErrors(result.error.issues, input) };
  }
  const errors = crossFieldErrors(result.data, now);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: result.data as ValidSiteSettings };
}

/** The body of a Site's creation: `{ slug, settings }`. The Slug is lowercased and never changes afterwards. */
export function parseNewSite(input: unknown, now: Date = new Date()): ParseResult<ValidNewSite> {
  const result = newSiteSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, errors: toErrors(result.error.issues, input) };
  }
  const errors = crossFieldErrors(result.data.settings, now).map((e) => ({ ...e, path: `settings.${e.path}` }));
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: result.data as unknown as ValidNewSite };
}
