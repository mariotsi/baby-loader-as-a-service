import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { enUS, it as itLocale } from 'date-fns/locale';
import { type MediaUrl, mediaUrlSchema } from './birthMedia.ts';
import { commonCopy } from './copy/common.ts';
import { type PublicPageCopy, publicPageCopy } from './copy/publicPage.ts';
import { countdownDays } from './countdown.ts';
import { inPlatformOrder, type Lang } from './i18n.ts';
import { googleMapsUrl } from './place.ts';
import { siteShortName, twemojiUrl } from './siteAppIdentity.ts';
import { type BirthDetails, type SiteSettings, shownBabyName } from './siteSettings.ts';

/**
 * What a Site's Public page shows, decided from its Site settings, a language
 * and the current time. Only strings and plain data come out, so the page
 * lays them out without rules of its own, and every value crosses into
 * Client Components as is.
 */

/**
 * Where the Born state's pictures are served from. The caller resolves them,
 * since the server and the editor serve them differently (see birthMediaUrl
 * and useBirthMediaUrl); the view decides whether the page shows them.
 */
export type BornMedia = {
  photo: MediaUrl | null;
  video: MediaUrl | null;
  /** Shown in place of a missing photo. */
  placeholder: MediaUrl;
};

/** For views that never draw the Born state's media, like the share image. */
export const NO_BORN_MEDIA: BornMedia = {
  photo: null,
  video: null,
  placeholder: mediaUrlSchema.parse('/website-assets/born-placeholder-v1.png'),
};

export type MilestoneItem = {
  emoji: string;
  date: string;
  label: string;
  /** Null when the Milestone has no Place. */
  place: {
    address: string;
    lat: number;
    lon: number;
    /** Where the map and the address lead. */
    url: string;
    /** Names that link: "Open <address> in Google Maps". */
    linkLabel: string;
  } | null;
};

export type PublicPageView = {
  lang: Lang;
  /** The Owner's line in the header, in both states; null when there is none in this language. */
  pageName: string | null;
  tagline: string;
  title: string;
  titleLead: string;
  titleName: string;
  /** Null in the Born state and when there is no Due date. */
  waiting: {
    dueDate: string;
    /** The number of days, or null on the Due date itself. */
    count: number | null;
    unit: string;
    lateNote: string | null;
    lateScene?: { baby: string; mum: string };
    /** The week of pregnancy, counting the Due date as the end of week 40; null before week 1. */
    week: { number: number; label: string } | null;
  } | null;
  born: {
    bornOn: string;
    age: number;
    ageLabel: string;
    stats: { label: string; value: string }[];
    message: string | null;
    /** The birth photo, else the placeholder. */
    photoUrl: MediaUrl;
    /** Null when the Site has no Birth video. */
    video: { url: MediaUrl; replay: string; reveal: PublicPageCopy['reveal'] } | null;
  } | null;
  milestones: { title: string; items: MilestoneItem[] } | null;
  /** Names the Language switcher in this view's language. */
  languageLabel: string;
  share: string;
  linkCopied: string;
  /** The push button's words that depend on the Site; the rest are the same on every Site (see publicPageCopy). */
  push: {
    subscribe: string;
    subscribed: string;
    /** What a home screen writes under the Site icon. */
    appName: string;
    appIcon: string;
  };
};

const LOCALES = { en: enUS, it: itLocale };
const DATE_FORMAT: Record<Lang, string> = { en: 'MMMM d, yyyy', it: 'd MMMM yyyy' };
/** The word between a birth's date and its time: "October 19, 2026 at 10:30". */
const AT: Record<Lang, string> = { en: 'at', it: 'alle' };

/** One view per Language the Site speaks, in the Platform's order, as the Language switcher lists them. */
export function publicPageViews(
  settings: SiteSettings,
  now: Date = new Date(),
  media: BornMedia = NO_BORN_MEDIA
): PublicPageView[] {
  return inPlatformOrder(settings.languages).map((lang) => publicPageView(settings, lang, now, media));
}

export function publicPageView(
  settings: SiteSettings,
  lang: Lang,
  now: Date = new Date(),
  media: BornMedia = NO_BORN_MEDIA
): PublicPageView {
  const t = publicPageCopy[lang];
  const { birth } = settings;
  return {
    lang,
    pageName: settings.pageName[lang]?.trim() || null,
    ...headline(settings, t),
    waiting: !birth.born && settings.dueDate ? waitingView(settings.dueDate, settings.timezone, lang, now) : null,
    born: birth.born ? bornView(birth.details, settings.timezone, settings.sex, lang, now, media) : null,
    milestones: milestonesView(settings.milestones, lang),
    languageLabel: commonCopy[lang].languageLabel,
    share: t.share,
    linkCopied: t.linkCopied,
    push: {
      subscribe: birth.born ? t.subscribeBorn : t.subscribeWaiting(settings.privacy.showSex ? settings.sex : 'unknown'),
      subscribed: birth.born ? t.subscribedBorn : t.subscribedWaiting,
      appName: siteShortName(settings, lang),
      appIcon: settings.icon ? twemojiUrl(settings.icon) : '/icon-192.png',
    },
  };
}

/** Privacy settings apply only while Waiting: the Born state announces the name and Sex. */
function headline(
  settings: SiteSettings,
  t: PublicPageCopy
): Pick<PublicPageView, 'tagline' | 'title' | 'titleLead' | 'titleName'> {
  const born = settings.birth.born;
  const titleLead = born ? t.bornTitle(settings.sex) : t.waitingTitle;
  const titleName = shownBabyName(settings) ?? (born ? t.littleOne(settings.sex) : t.someone);
  return {
    tagline: born ? t.bornTagline(settings.sex) : t.waitingTagline,
    title: [titleLead, titleName].filter(Boolean).join(' '),
    titleLead,
    titleName,
  };
}

function bornView(
  details: BirthDetails,
  timezone: string,
  sex: SiteSettings['sex'],
  lang: Lang,
  now: Date,
  media: BornMedia
): NonNullable<PublicPageView['born']> {
  const t = publicPageCopy[lang];
  const bornAt = format(new TZDate(new Date(details.datetime), timezone), `${DATE_FORMAT[lang]} '${AT[lang]}' HH:mm`, {
    locale: LOCALES[lang],
  });
  return {
    bornOn: t.bornOn(bornAt, sex),
    age: Math.max(0, differenceInCalendarDays(new TZDate(now, timezone), new TZDate(details.datetime, timezone))),
    ageLabel: t.ageLabel(
      Math.max(0, differenceInCalendarDays(new TZDate(now, timezone), new TZDate(details.datetime, timezone)))
    ),
    stats: [
      details.weightGrams ? { label: t.weightLabel, value: `${details.weightGrams} g` } : null,
      details.lengthCm ? { label: t.lengthLabel, value: `${details.lengthCm} cm` } : null,
    ].filter((stat): stat is { label: string; value: string } => stat !== null),
    message: details.message[lang]?.trim() || null,
    photoUrl: media.photo ?? media.placeholder,
    video: media.video ? { url: media.video, replay: t.replayWelcome, reveal: t.reveal } : null,
  };
}

function milestonesView(milestones: SiteSettings['milestones'], lang: Lang): PublicPageView['milestones'] {
  if (milestones.length === 0) {
    return null;
  }
  return {
    title: publicPageCopy[lang].milestonesTitle,
    items: [...milestones]
      .sort((a, b) => a.date.localeCompare(b.date))
      // A valid Site has a label in every Language it speaks.
      .map((m) => ({
        emoji: m.emoji,
        date: formatDay(m.date, lang),
        label: m.label[lang] ?? '',
        place: m.place
          ? { ...m.place, url: googleMapsUrl(m.place), linkLabel: publicPageCopy[lang].openInMaps(m.place.address) }
          : null,
      })),
  };
}

function waitingView(dueDate: string, timezone: string, lang: Lang, now: Date): NonNullable<PublicPageView['waiting']> {
  const t = publicPageCopy[lang];
  const days = countdownDays(dueDate, timezone, now);
  const due = `${t.duePrefix} ${formatDay(dueDate, lang)}`;
  const week = pregnancyWeek(days);
  const weekView = week ? { number: week, label: t.weekOf(week) } : null;
  if (days > 0) {
    return { dueDate: due, count: days, unit: t.daysLeft(days), lateNote: null, week: weekView };
  }
  if (days === 0) {
    return { dueDate: due, count: null, unit: t.dueToday, lateNote: null, week: weekView };
  }
  return {
    dueDate: due,
    count: -days,
    unit: t.daysLate(-days),
    lateNote: t.lateNote,
    lateScene: { baby: t.babyLate, mum: t.mumLate },
    week: weekView,
  };
}

/** Pregnancies are dated to 40 weeks at the Due date: 42 days before it is week 34. */
function pregnancyWeek(daysToDue: number): number | null {
  const week = 40 - Math.floor(daysToDue / 7);
  return week >= 1 ? week : null;
}

/** A calendar day such as a Due date: no time, so no Timezone. */
function formatDay(day: string, lang: Lang): string {
  return format(parseISO(day), DATE_FORMAT[lang], { locale: LOCALES[lang] });
}
