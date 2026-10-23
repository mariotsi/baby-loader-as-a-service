import { SendNotificationForm } from '@/components/admin/SendNotificationForm';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { fallbackLang } from '@/lib/i18n';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import styles from '../../admin.module.css';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;

  return (
    <PageShell
      width="medium"
      nav={
        <ButtonLink href={`/admin/${site.slug}`} variant="ghost" size="sm">
          Back to {name}
        </ButtonLink>
      }
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Send a notification</h1>
          <p className={styles.lead}>To everyone subscribed on {name}&apos;s page.</p>
        </div>
      </div>
      <SendNotificationForm slug={site.slug} lang={fallbackLang(site.languages)} />
    </PageShell>
  );
}
