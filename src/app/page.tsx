import { addDays, format } from 'date-fns';
import { PagePreview } from '@/components/PagePreview';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { publicPageView } from '@/lib/publicPageView';
import { defaultSiteSettings, type SiteSettings } from '@/lib/siteSettings';
import { getFont, googleFontsHref } from '@/lib/theme';
import styles from './page.module.css';

const SAMPLE_THEME = { palette: 'blush', font: 'quicksand' };

/** A sample page six weeks from its Due date, as the preview beside the pitch. */
function sampleView() {
  const now = new Date();
  const settings = {
    ...defaultSiteSettings,
    babyName: 'Emma',
    sex: 'female',
    dueDate: format(addDays(now, 42), 'yyyy-MM-dd'),
    timezone: 'UTC',
    theme: SAMPLE_THEME,
  } as SiteSettings;
  return publicPageView(settings, 'en', now);
}

export default function MarketingPage() {
  return (
    <PageShell width="wide">
      <link rel="stylesheet" href={googleFontsHref([getFont(SAMPLE_THEME.font)])} />
      <div className={styles.hero}>
        <div className={styles.pitch}>
          <p className={styles.eyebrow}>For the days before the big day</p>
          <h1 className={styles.title}>A page for the wait, made yours</h1>
          <p className={styles.lead}>
            Create a countdown and birth announcement page for your baby. Pick your colors and your letters, choose what
            to show, and share it on your own link.
          </p>
          <div className={styles.actions}>
            <ButtonLink href="/signup" variant="primary" icon="sparkles">
              Create your page
            </ButtonLink>
            <ButtonLink href="/login">Log in</ButtonLink>
          </div>
        </div>
        <div className={styles.preview} aria-hidden="true">
          <PagePreview view={sampleView()} theme={SAMPLE_THEME} />
        </div>
      </div>
    </PageShell>
  );
}
