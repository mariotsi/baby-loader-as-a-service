import { TZDate } from '@date-fns/tz';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { enUS, it as itLocale } from 'date-fns/locale';
import { commonCopy } from './copy/common.ts';
import { type PublicPageCopy, publicPageCopy } from './copy/publicPage.ts';
import { countdownDays } from './countdown.ts';
import { inPlatformOrder, type Lang } from './i18n.ts';
import { googleMapsUrl } from './place.ts';
import type { BirthDetails, SiteSettings } from './siteSettings.ts';

/**
 * What a Site's Public page shows, decided from its Site settings, a language
 * and the current time. Only strings and plain data come out, so the page
 * lays them out without rules of its own, and every value crosses into
 * Client Components as is.
 */

/** The push button's copy, already picked for the Site's state. */
export type PushButtonCopy = {
  checking: string;
  subscribed: string;
  subscribe: string;
  subscribing: string;
  unsubscribe: string;
  subscribeOk: string;
  unsubscribeOk: string;
  errorGeneric: string;
  errorUnsupported: string;
  errorDenied: string;
  iosHomeScreen: string;
  iosHomeScreenLink: string;
  iosVersion: string;
  iosDenied: string;
  iosSettingsLink: string;
  androidUseChrome: string;
  androidDenied: string;
  androidSettingsLink: string;
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
  /** "It's a girl", or null when hidden or unknown. */
  sex: string | null;
  /** Null in the Born state and when there is no Due date. */
  waiting: {
    dueDate: string;
    /** The number of days, or null on the Due date itself. */
    count: number | null;
    unit: string;
    lateNote: string | null;
    /** The week of pregnancy, counting the Due date as the end of week 40; null before week 1 and once late. */
    week: { number: number; label: string } | null;
  } | null;
  born: {
    bornOn: string;
    age: number;
    ageLabel: string;
    stats: { label: string; value: string }[];
    message: string | null;
  } | null;
  milestones: { title: string; items: MilestoneItem[] } | null;
  /** Names the Language switcher in this view's language. */
  languageLabel: string;
  share: string;
  push: PushButtonCopy;
};

const LOCALES = { en: enUS, it: itLocale };
const DATE_FORMAT: Record<Lang, string> = { en: 'MMMM d, yyyy', it: 'd MMMM yyyy' };

/** One view per Language the Site speaks, in the Platform's order, as the Language switcher lists them. */
export function publicPageViews(settings: SiteSettings, now: Date = new Date()): PublicPageView[] {
  return inPlatformOrder(settings.languages).map((lang) => publicPageView(settings, lang, now));
}

export function publicPageView(settings: SiteSettings, lang: Lang, now: Date = new Date()): PublicPageView {
  const t = publicPageCopy[lang];
  const { birth } = settings;
  return {
    lang,
    pageName: settings.pageName[lang]?.trim() || null,
    ...headline(settings, t),
    waiting: !birth.born && settings.dueDate ? waitingView(settings.dueDate, settings.timezone, lang, now) : null,
    born: birth.born ? bornView(birth.details, settings.timezone, settings.sex, lang, now) : null,
    milestones: milestonesView(settings.milestones, lang),
    languageLabel: commonCopy[lang].languageLabel,
    share: t.share,
    push: pushButtonCopy(t, birth.born),
  };
}

/** Privacy settings apply only while Waiting: the Born state announces the name and Sex. */
function headline(
  settings: SiteSettings,
  t: PublicPageCopy
): Pick<PublicPageView, 'tagline' | 'title' | 'titleLead' | 'titleName' | 'sex'> {
  const born = settings.birth.born;
  const name = (born || settings.privacy.showName) && settings.babyName ? settings.babyName : null;
  const titleLead = born ? t.bornTitle(settings.sex) : t.waitingTitle;
  const titleName = born ? settings.babyName : (name ?? t.someone);
  return {
    tagline: born ? t.bornTagline(settings.sex) : t.waitingTagline,
    title: [titleLead, titleName].filter(Boolean).join(' '),
    titleLead,
    titleName,
    sex: null,
  };
}

function bornView(
  details: BirthDetails,
  timezone: string,
  sex: SiteSettings['sex'],
  lang: Lang,
  now: Date
): NonNullable<PublicPageView['born']> {
  const t = publicPageCopy[lang];
  const bornAt = format(new TZDate(new Date(details.datetime), timezone), `${DATE_FORMAT[lang]}, HH:mm`, {
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
  return { dueDate: due, count: -days, unit: t.daysLate(-days), lateNote: t.lateNote, week: null };
}

/** Pregnancies are dated to 40 weeks at the Due date: 42 days before it is week 34. */
function pregnancyWeek(daysToDue: number): number | null {
  const week = 40 - Math.floor(daysToDue / 7);
  return daysToDue >= 0 && week >= 1 ? week : null;
}

/** A calendar day such as a Due date: no time, so no Timezone. */
function formatDay(day: string, lang: Lang): string {
  return format(parseISO(day), DATE_FORMAT[lang], { locale: LOCALES[lang] });
}

function pushButtonCopy(t: PublicPageCopy, born: boolean): PushButtonCopy {
  return {
    checking: t.checking,
    subscribed: born ? t.subscribedBorn : t.subscribedWaiting,
    subscribe: born ? t.subscribeBorn : t.subscribeWaiting,
    subscribing: t.subscribing,
    unsubscribe: t.unsubscribe,
    subscribeOk: t.subscribeOk,
    unsubscribeOk: t.unsubscribeOk,
    errorGeneric: t.errorGeneric,
    errorUnsupported: t.errorUnsupported,
    errorDenied: t.errorDenied,
    iosHomeScreen: t.iosHomeScreen,
    iosHomeScreenLink: t.iosHomeScreenLink,
    iosVersion: t.iosVersion,
    iosDenied: t.iosDenied,
    iosSettingsLink: t.iosSettingsLink,
    androidUseChrome: t.androidUseChrome,
    androidDenied: t.androidDenied,
    androidSettingsLink: t.androidSettingsLink,
  };
}
