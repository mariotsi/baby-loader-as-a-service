import * as z from 'zod/mini';
import { instantIn, localIn, settledBirthMilestones, withBirth } from './birthAnnouncement.ts';
import { LANGS, type Lang } from './i18n.ts';
import {
  type BirthDetails,
  type BirthMedia,
  DEFAULT_SITE_ICON_EMOJI,
  type Milestone,
  type PageName,
  parseSiteSettings,
  type SiteSettings,
  type SiteSettingsError,
  type SiteSettingsInput,
  type TextPerLanguage,
} from './siteSettings.ts';
import { DEFAULT_FONT, DEFAULT_PALETTE } from './theme.ts';

/**
 * A Site's settings as its forms hold them while the Owner types: the
 * editor's and the new Site's. Free of browser and server imports, so the
 * mapping both forms share runs in `npm test`. The forms keep their markup and
 * how they save; this module says what a draft sends and whether it changed.
 */

/** A Birth media field: the file saved, a file picked and not yet uploaded, or none. */
export type MediaDraft = BirthMedia | File | null;

/** What a save may send for a media field: a picked file is uploaded first, and sends nothing until it is. */
export function storedMedia(draft: MediaDraft): BirthMedia | null {
  return draft instanceof File ? null : draft;
}

/** A Milestone as a form holds it: with the text in its Place field, which is not yet a Place while being typed. */
export type MilestoneDraft = SiteSettingsInput['milestones'][number] & { placeText: string };

/**
 * Every field on a Site's settings form, as typed. The Birth and the Birth
 * video are not here: they change apart from the rest (see BirthDraft).
 */
export interface SiteDraft {
  babyName: string;
  sex: SiteSettings['sex'];
  /** A `date` input's value, '' while not set. */
  dueDate: string;
  languages: Lang[];
  timezone: string;
  palette: string;
  font: string;
  showName: boolean;
  showSex: boolean;
  /** Blank texts included, as typed; a save drops them. */
  pageName: PageName;
  iconIsEmoji: boolean;
  /** Kept while the loading baby is picked, so switching back brings the emoji back. */
  iconEmoji: string;
  milestones: MilestoneDraft[];
}

/** The Birth details as the Birth dialog holds them while the Owner types. */
export interface BirthDraft {
  born: boolean;
  /** A `datetime-local` value, on the wall clock in the Site's Timezone. */
  datetime: string;
  weight: string;
  lengthCm: string;
  message: BirthDetails['message'];
  photo: MediaDraft;
}

/** What a Site's settings form sends beside its draft: the Birth and the Birth video, saved apart. */
export interface DraftBirth {
  birth: SiteSettingsInput['birth'];
  birthVideo: MediaDraft;
}

const WAITING: DraftBirth = { birth: { born: false, details: null }, birthVideo: null };

/** The texts written, one per Language: a text in a Language the Site no longer speaks is kept. */
export function writtenTexts(texts: TextPerLanguage): TextPerLanguage {
  return Object.fromEntries(Object.entries(texts).filter(([, text]) => text.trim()));
}

/** A new Site's draft: in the Language its Owner reads the Platform in, and the Timezone their browser is in. */
export function newSiteDraft(lang: Lang, timezone: string): SiteDraft {
  return {
    babyName: '',
    sex: 'unknown',
    dueDate: '',
    languages: [lang],
    timezone,
    palette: DEFAULT_PALETTE,
    font: DEFAULT_FONT,
    showName: true,
    showSex: true,
    pageName: {},
    iconIsEmoji: false,
    iconEmoji: DEFAULT_SITE_ICON_EMOJI,
    milestones: [],
  };
}

/** A saved Site's settings as its form starts. */
export function draftOfSite(site: SiteSettings): SiteDraft {
  return {
    babyName: site.babyName,
    sex: site.sex,
    dueDate: site.dueDate ?? '',
    languages: site.languages,
    timezone: site.timezone,
    palette: site.theme.palette,
    font: site.theme.font,
    showName: site.privacy.showName,
    showSex: site.privacy.showSex,
    pageName: site.pageName,
    iconIsEmoji: site.icon !== null,
    iconEmoji: site.icon ?? DEFAULT_SITE_ICON_EMOJI,
    milestones: site.milestones.map((m) => ({ ...m, placeText: m.place?.address ?? '' })),
  };
}

/**
 * The Site settings a save sends for `draft`, with `birth` beside it. Blank
 * texts are dropped, and the Birth milestone stands on the day of birth in
 * the draft's Timezone, or goes while Waiting.
 */
export function settingsOfDraft(draft: SiteDraft, { birth, birthVideo }: DraftBirth = WAITING): SiteSettingsInput {
  const milestones = settledBirthMilestones(draft.milestones, birth, draft.timezone);
  return {
    babyName: draft.babyName,
    sex: draft.sex,
    dueDate: draft.dueDate || null,
    birth,
    milestones: milestones.map(({ placeText: _, ...m }) => ({ ...m, label: writtenTexts(m.label) })),
    languages: draft.languages,
    timezone: draft.timezone,
    theme: { palette: draft.palette, font: draft.font },
    privacy: { showName: draft.showName, showSex: draft.showSex },
    pageName: writtenTexts(draft.pageName),
    icon: draft.iconIsEmoji ? draft.iconEmoji : null,
    birthVideo: storedMedia(birthVideo),
  };
}

/**
 * Whether two drafts would save the same: the Site settings they send, the
 * Place texts not picked yet, and the Birth video picked and not yet uploaded.
 */
export function sameDraft(a: SiteDraft, aBirth: DraftBirth, b: SiteDraft, bBirth: DraftBirth): boolean {
  return draftKey(a, aBirth) === draftKey(b, bBirth);
}

function draftKey(draft: SiteDraft, birth: DraftBirth): string {
  const video = birth.birthVideo;
  return JSON.stringify([
    settingsOfDraft(draft, birth),
    draft.milestones.map((m) => m.placeText),
    video instanceof File ? [video.name, video.size, video.lastModified] : null,
  ]);
}

/** The Site settings `input` stands for when it passes every rule, else `previous`: what previews draw while a field is half filled. */
export function lastValidSettings(
  input: SiteSettingsInput,
  previous: SiteSettings,
  now: Date = new Date()
): SiteSettings {
  const checked = parseSiteSettings(input, now);
  return checked.ok ? checked.value : previous;
}

/**
 * The Place fields holding text that was never picked from the suggestions.
 * Only a form knows about them, so the rule runs beside Site settings'.
 */
export function unpickedPlaces(milestones: MilestoneDraft[]): SiteSettingsError[] {
  return milestones.flatMap((m, i): SiteSettingsError[] =>
    m.placeText.trim() && !m.place ? [{ path: `milestones.${i}.place`, code: 'invalidOption' }] : []
  );
}

/** Everything in `draft` that stops a save: the Site settings rules, then Places typed and never picked. */
export function draftProblems(
  draft: SiteDraft,
  birth: DraftBirth = WAITING,
  now: Date = new Date()
): SiteSettingsError[] {
  const checked = parseSiteSettings(settingsOfDraft(draft, birth), now);
  return [...(checked.ok ? [] : checked.errors), ...unpickedPlaces(draft.milestones)];
}

/** A saved Site's Birth as the Birth dialog starts: its time on the wall clock in the Site's Timezone. */
export function birthDraftOf(site: Pick<SiteSettings, 'birth' | 'timezone'>): BirthDraft {
  const details = site.birth.details;
  return {
    born: site.birth.born,
    datetime: details ? localIn(details.datetime, site.timezone) : '',
    weight: details?.weightGrams?.toString() ?? '',
    lengthCm: details?.lengthCm?.toString() ?? '',
    message: details?.message ?? {},
    photo: details?.photo ?? null,
  };
}

/** The Birth as Site settings hold it, from the fields as typed: the time is the wall clock in `timezone`. */
export function birthSettings(b: BirthDraft, timezone: string): SiteSettingsInput['birth'] {
  if (!b.born) {
    return { born: false, details: null };
  }
  return {
    born: true,
    details: {
      datetime: instantIn(b.datetime, timezone),
      weightGrams: b.weight ? Number(b.weight) : null,
      lengthCm: b.lengthCm ? Number(b.lengthCm) : null,
      message: writtenTexts(b.message),
      photo: storedMedia(b.photo),
    },
  };
}

/**
 * The Site as saving `b` from the Birth dialog would leave it: as last saved
 * (`saved`), with `b`, and the name, the Sex and the Birth video as the form
 * holds them. The time is read in the saved Timezone, which is what the Birth
 * route reads it in.
 */
export function birthWrite(
  saved: SiteSettings,
  b: BirthDraft,
  form: Pick<SiteDraft, 'babyName' | 'sex'> & { birthVideo: MediaDraft }
): SiteSettings {
  if (!b.born) {
    return withBirth(saved, null);
  }
  // As typed, so not yet checked: callers read the result through parseSiteSettings or parseBirthPreview.
  const { details } = birthSettings(b, saved.timezone) as unknown as { details: BirthDetails };
  return withBirth(saved, {
    babyName: form.babyName,
    sex: form.sex,
    details,
    birthVideo: storedMedia(form.birthVideo),
  });
}

/**
 * A form's Milestones once the Birth is saved: the Birth milestone on the
 * day the server saved, with the Owner's unsaved label and emoji. One the
 * Owner removed and has not saved yet (`removedHere`) stays removed.
 */
export function withSavedBirthMilestone(
  drafts: MilestoneDraft[],
  saved: Milestone[],
  removedHere: boolean
): MilestoneDraft[] {
  const savedOne = saved.find((m) => m.kind === 'birth');
  if (!savedOne) {
    return drafts.filter((m) => m.kind !== 'birth');
  }
  if (hasBirthMilestone(drafts)) {
    return drafts.map((m) => (m.kind === 'birth' ? { ...m, date: savedOne.date } : m));
  }
  return removedHere ? drafts : [...drafts, { ...savedOne, placeText: savedOne.place?.address ?? '' }];
}

export function hasBirthMilestone(milestones: readonly { kind?: 'birth' }[]): boolean {
  return milestones.some((m) => m.kind === 'birth');
}

/**
 * A draft kept in storage, such as the new Site's in `sessionStorage`, if it
 * still has the shape this module writes: one from an older Platform reads
 * as none, and the form starts over.
 */
const storedDraftSchema = z.object({
  babyName: z.string(),
  sex: z.enum(['female', 'male', 'unknown']),
  dueDate: z.string(),
  languages: z.array(z.enum(LANGS as readonly Lang[] as [Lang, ...Lang[]])).check(z.minLength(1)),
  timezone: z.string(),
  palette: z.string(),
  font: z.string(),
  showName: z.boolean(),
  showSex: z.boolean(),
  pageName: z.partialRecord(z.enum(LANGS as readonly Lang[] as [Lang, ...Lang[]]), z.string()),
  iconIsEmoji: z.boolean(),
  iconEmoji: z.string(),
  milestones: z.array(z.looseObject({ placeText: z.string() })),
});

export function readStoredDraft(value: unknown): SiteDraft | null {
  const result = storedDraftSchema.safeParse(value);
  return result.success ? (result.data as SiteDraft) : null;
}
