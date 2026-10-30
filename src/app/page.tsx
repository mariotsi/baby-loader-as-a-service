import { addDays, format } from 'date-fns';
import { PagePreview } from '@/components/PagePreview';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { platformCopy } from '@/lib/copy/platform';
import type { Lang } from '@/lib/i18n';
import { platformLang } from '@/lib/i18nNext';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';
import { getFont, googleFontsHref } from '@/lib/theme';
import styles from './page.module.css';

const SAMPLE_THEME = { palette: 'blush', font: 'quicksand' };

/** A sample page six weeks from its Due date, as the preview beside the pitch. */
function sampleView(lang: Lang) {
  const now = new Date();
  const settings = {
    ...defaultSiteSettings,
    babyName: 'Emma',
    sex: 'female',
    dueDate: format(addDays(now, 42), 'yyyy-MM-dd'),
    timezone: 'UTC',
    theme: SAMPLE_THEME,
  } as SiteSettings;
  return publicPageView(settings, lang, now);
}

export default async function MarketingPage() {
  const lang = await platformLang();
  const t = platformCopy[lang].marketing;
  return (
    <PageShell width="wide">
      <link rel="stylesheet" href={googleFontsHref([getFont(SAMPLE_THEME.font)])} />
      <div className={styles.hero}>
        <div className={styles.pitch}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.lead}</p>
          <div className={styles.actions}>
            <ButtonLink href="/signup" variant="primary" icon="plus">
              {t.createPage}
            </ButtonLink>
            <ButtonLink href="/login">{t.logIn}</ButtonLink>
          </div>
        </div>
        <div className={styles.preview} aria-hidden="true">
          <PagePreview view={sampleView(lang)} theme={SAMPLE_THEME} />
        </div>
      </div>
    </PageShell>
  );
}
