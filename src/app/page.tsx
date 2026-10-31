import { HomeDeck } from '@/components/HomeDeck';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { platformCopy } from '@/lib/copy/platform';
import { platformLang } from '@/lib/i18nNext';
import styles from './page.module.css';

export default async function MarketingPage() {
  const lang = await platformLang();
  const t = platformCopy[lang].marketing;
  return (
    <PageShell width="wide">
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
        <div className={styles.preview}>
          <HomeDeck lang={lang} />
        </div>
      </div>
    </PageShell>
  );
}
