/** What announcing the birth does besides saving it: the Birth milestone and the birth notification. */
import { platformCopy } from './copy/platform.ts';
import type { Lang } from './i18n.ts';
import type { Milestone, SiteSettings } from './siteSettings.ts';

/** The Birth milestone's emoji, until the Owner picks another. */
export const BIRTH_MILESTONE_EMOJI = '👶';

interface BirthChange {
  /** Whether the Site was Born before this change. */
  wasBorn: boolean;
  born: boolean;
  /** The day of birth, yyyy-MM-dd, when Born. */
  date: string;
  languages: readonly Lang[];
  sex: SiteSettings['sex'];
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
