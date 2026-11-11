/**
 * What the Birth does to the rest of the Site settings: the Birth milestone
 * and the Birth notification. Free of server imports, so the editor and its
 * previews follow the same rules as the server that saves them.
 */
import { TZDate } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';
import * as z from 'zod/mini';
import { platformCopy } from './copy/platform.ts';
import type { Lang } from './i18n.ts';
import {
  type Birth,
  type BirthDetails,
  type CalendarDay,
  calendarDaySchema,
  emojiSchema,
  type Milestone,
  type SiteSettings,
} from './siteSettings.ts';

/** The Birth milestone's emoji, until the Owner picks another. */
export const BIRTH_MILESTONE_EMOJI = emojiSchema.parse('👶');

/** What the Birth dialog saves: the Birth details, with the name, the Sex and the Birth video beside them. */
export interface BirthFields {
  babyName: SiteSettings['babyName'];
  sex: SiteSettings['sex'];
  details: BirthDetails;
  birthVideo: SiteSettings['birthVideo'];
}

interface BirthChange {
  /** Whether the Site was Born before this change. */
  wasBorn: boolean;
  born: boolean;
  /** The day of birth when Born. */
  date: CalendarDay;
  languages: readonly Lang[];
  sex: SiteSettings['sex'];
}

/** The day of birth, yyyy-MM-dd, in the Site's Timezone; null while `datetime` is not a date and time yet. */
export function birthDay(datetime: string, timezone: string): CalendarDay | null {
  const instant = parseISO(datetime);
  return isValid(instant) ? calendarDaySchema.parse(format(new TZDate(instant, timezone), 'yyyy-MM-dd')) : null;
}

const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

/** A `datetime-local` value: a day and a time on a wall clock, with no zone, such as the Birth's time as typed. */
export const wallClockTimeSchema = z
  .string()
  .check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/))
  .brand<'WallClockTime'>();
export type WallClockTime = z.output<typeof wallClockTimeSchema>;
export function isWallClockTime(value: unknown): value is WallClockTime {
  return wallClockTimeSchema.safeParse(value).success;
}

/** A `datetime-local` value, read as the wall clock in `timezone`, as an ISO 8601 instant; '' while it is not one. */
export function instantIn(local: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) {
    return '';
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const instant = new TZDate(year, month - 1, day, hour, minute, timezone);
  return isValid(instant) ? new Date(instant.getTime()).toISOString() : '';
}

/** An instant as a `datetime-local` value on the wall clock in `timezone`: the opposite of instantIn. */
export function localIn(instant: Date | string, timezone: string): WallClockTime {
  return wallClockTimeSchema.parse(format(new TZDate(new Date(instant), timezone), LOCAL_DATETIME));
}

/**
 * The Milestones once the Birth changes. Announcing adds the Birth milestone,
 * replacing one left from an earlier announcement; going back to the
 * Countdown removes it; changing the birth's day moves it, keeping the label
 * and emoji the Owner may have changed. `create` gives a new Milestone the
 * editor's own fields.
 */
export function syncBirthMilestone<M extends Milestone>(
  milestones: M[],
  { wasBorn, born, date, languages, sex }: BirthChange,
  create: (milestone: Milestone) => M
): M[] {
  const others = milestones.filter((m) => m.kind !== 'birth');
  if (!born) {
    return others;
  }
  if (wasBorn) {
    return milestones.map((m) => (m.kind === 'birth' ? { ...m, date } : m));
  }
  const label = Object.fromEntries(languages.map((lang) => [lang, platformCopy[lang].settings.birthMilestone(sex)]));
  return [...others, create({ emoji: BIRTH_MILESTONE_EMOJI, label, date, kind: 'birth' })];
}

/**
 * The Site settings with `fields` as the Birth, or back in the Countdown with
 * null. The Birth milestone follows; the Privacy settings stay as the Owner
 * chose them, since the Born state shows the name and the Sex whatever they say.
 */
export function withBirth(settings: SiteSettings, fields: BirthFields | null): SiteSettings {
  if (!fields) {
    return {
      ...settings,
      birth: { born: false, details: null },
      milestones: settings.milestones.filter((m) => m.kind !== 'birth'),
    };
  }
  const day = birthDay(fields.details.datetime, settings.timezone);
  return {
    ...settings,
    babyName: fields.babyName,
    sex: fields.sex,
    birth: { born: true, details: fields.details },
    birthVideo: fields.birthVideo,
    milestones:
      day === null
        ? settings.milestones
        : syncBirthMilestone(
            settings.milestones,
            { wasBorn: settings.birth.born, born: true, date: day, languages: settings.languages, sex: fields.sex },
            (m) => m
          ),
  };
}

/**
 * The Birth milestone in Site settings saved apart from the Birth: its date
 * is the day of birth in `timezone`, and there is none while Waiting. One the
 * Owner removed stays removed.
 */
export function settledBirthMilestones<M extends { kind?: 'birth'; date: string }>(
  milestones: M[],
  birth: Pick<Birth, 'born'> & { details: { datetime: string } | null },
  timezone: string
): M[] {
  const day = birth.born && birth.details ? birthDay(birth.details.datetime, timezone) : null;
  return day === null
    ? milestones.filter((m) => m.kind !== 'birth')
    : milestones.map((m) => (m.kind === 'birth' ? { ...m, date: day } : m));
}

/**
 * The birth notification in each Language: "È nata Sofia!" and the Birth
 * message, or an invitation to the page when there is none in that Language.
 */
export function birthNotificationMessages(
  settings: Pick<SiteSettings, 'babyName' | 'sex' | 'languages'>,
  message: Partial<Record<Lang, string>>
): Partial<Record<Lang, { title: string; body: string }>> {
  return Object.fromEntries(
    settings.languages.map((lang) => {
      const news = platformCopy[lang].settings.birthNotification(settings.babyName.trim(), settings.sex);
      return [lang, { title: news.title, body: message[lang]?.trim() || news.body }];
    })
  );
}
