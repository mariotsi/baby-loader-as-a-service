import { SendNotificationForm } from '@/components/dashboard/SendNotificationForm';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { platformCopy } from '@/lib/copy/platform';
import { fallbackLang } from '@/lib/i18n';
import { platformLang } from '@/lib/i18nNext';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import styles from '../../dashboard.module.css';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;
  const { dashboard, send } = platformCopy[await platformLang()];

  return (
    <PageShell
      width="medium"
      nav={
        <ButtonLink href={`/dashboard/${site.slug}`} variant="ghost" size="sm">
          {dashboard.backTo(name)}
        </ButtonLink>
      }
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{send.title}</h1>
          <p className={styles.lead}>{send.lead(name)}</p>
        </div>
      </div>
      <SendNotificationForm slug={site.slug} lang={fallbackLang(site.languages)} />
    </PageShell>
  );
}
