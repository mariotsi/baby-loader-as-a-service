import { TZDate } from '@date-fns/tz';
import { format, parseISO } from 'date-fns';
import { enUS, it as itLocale } from 'date-fns/locale';
import { countdownDays } from './countdown.ts';
import type { Lang } from './i18n.ts';
import { type Messages, messages } from './messages.ts';
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
};

export type PublicPageView = {
  lang: Lang;
  tagline: string;
  title: string;
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
    weightLine: string | null;
    lengthLine: string | null;
    message: string | null;
  } | null;
  milestones: { title: string; items: { date: string; label: string }[] } | null;
  /** Names the Language switcher in this view's language. */
  languageLabel: string;
  push: PushButtonCopy;
};

const LOCALES = { en: enUS, it: itLocale };
const DATE_FORMAT: Record<Lang, string> = { en: 'MMMM d, yyyy', it: 'd MMMM yyyy' };

/** One view per Language the Site speaks, in its order: the primary one first, as the Language switcher lists them. */
export function publicPageViews(settings: SiteSettings, now: Date = new Date()): PublicPageView[] {
  return settings.languages.map((lang) => publicPageView(settings, lang, now));
}

export function publicPageView(settings: SiteSettings, lang: Lang, now: Date = new Date()): PublicPageView {
  const t = messages[lang];
  const { birth } = settings;
  return {
    lang,
    ...headline(settings, t),
    waiting: !birth.born && settings.dueDate ? waitingView(settings.dueDate, settings.timezone, lang, now) : null,
    born: birth.born ? bornView(birth.details, settings.timezone, lang) : null,
    milestones: milestonesView(settings.milestones, lang),
    languageLabel: t.languageLabel,
    push: pushButtonCopy(t, birth.born),
  };
}

/** Privacy settings apply only while Waiting: the Born state announces the name and Sex. */
function headline(settings: SiteSettings, t: Messages): Pick<PublicPageView, 'tagline' | 'title' | 'sex'> {
  const born = settings.birth.born;
  const name = (born || settings.privacy.showName) && settings.babyName ? settings.babyName : null;
  const showSex = (born || settings.privacy.showSex) && settings.sex !== 'unknown';
  const sexes = { female: t.sexFemale, male: t.sexMale, unknown: null };
  return {
    tagline: born ? t.bornTagline : t.waitingTagline,
    title: born ? [t.bornTitle, name].filter(Boolean).join(' ') : `${t.waitingTitle} ${name ?? t.someone}`,
    sex: showSex ? sexes[settings.sex] : null,
  };
}

function bornView(details: BirthDetails, timezone: string, lang: Lang): NonNullable<PublicPageView['born']> {
  const t = messages[lang];
  const bornAt = format(new TZDate(new Date(details.datetime), timezone), `${DATE_FORMAT[lang]}, HH:mm`, {
    locale: LOCALES[lang],
  });
  return {
    bornOn: t.bornOn(bornAt),
    weightLine: details.weightGrams ? `${t.weightLabel}: ${details.weightGrams} g` : null,
    lengthLine: details.lengthCm ? `${t.lengthLabel}: ${details.lengthCm} cm` : null,
    message: details.message[lang]?.trim() || null,
  };
}

function milestonesView(milestones: SiteSettings['milestones'], lang: Lang): PublicPageView['milestones'] {
  if (milestones.length === 0) {
    return null;
  }
  return {
    title: messages[lang].milestonesTitle,
    items: [...milestones]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => ({ date: formatDay(m.date, lang), label: m.label })),
  };
}

function waitingView(dueDate: string, timezone: string, lang: Lang, now: Date): NonNullable<PublicPageView['waiting']> {
  const t = messages[lang];
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

function pushButtonCopy(t: Messages, born: boolean): PushButtonCopy {
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
  };
}
