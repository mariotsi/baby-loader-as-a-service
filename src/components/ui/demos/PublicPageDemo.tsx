import { addDays, format } from 'date-fns';
import { PublicPage } from '@/components/PublicPage';
import { publicPageViews } from '@/lib/publicPageView';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';

/** A Site speaking Italian and English, six weeks from its Due date, with a few Milestones. */
function sampleSettings(state: 'waiting' | 'born'): SiteSettings {
  const now = new Date();
  const day = (offset: number) => format(addDays(now, offset), 'yyyy-MM-dd');
  return {
    ...defaultSiteSettings,
    babyName: 'Emma',
    sex: 'female',
    dueDate: day(42),
    languages: ['it', 'en'],
    timezone: 'Europe/Rome',
    milestones: [
      { label: 'We found out!', date: day(-200) },
      { label: 'The first kick', date: day(-90) },
      { label: 'Her room is ready', date: day(-10) },
    ],
    birth:
      state === 'born'
        ? {
            born: true,
            details: {
              datetime: addDays(now, -3).toISOString(),
              weightGrams: 3015,
              lengthCm: 46,
              message: { en: 'Mum, baby (and dad) are doing great!', it: 'Mamma, bimba (e papà) stanno bene!' },
            },
          }
        : { born: false, details: null },
  } as SiteSettings;
}

/**
 * The real Public page with sample content, in the Palette and Font of the
 * Storybook toolbar. Notifications stay off: there is no push key here.
 */
export function PublicPageDemo({ state = 'waiting' }: { state?: 'waiting' | 'born' }) {
  return (
    <PublicPage
      views={publicPageViews(sampleSettings(state))}
      initialLang="en"
      slug="emma"
      vapidPublicKey={undefined}
    />
  );
}
