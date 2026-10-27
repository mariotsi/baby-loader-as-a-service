import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { platformCopy } from '@/lib/copy/platform';
import { platformLang } from '@/lib/i18nNext';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { listSubscriptionsBySite } from '@/lib/subscription';
import styles from '../../dashboard.module.css';

export default async function SubscriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;
  const lang = await platformLang();
  const { dashboard, subscriptions: t } = platformCopy[lang];
  const when = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' });

  const subscriptions = await listSubscriptionsBySite(site.id);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href={`/dashboard/${site.slug}`} variant="ghost" size="sm">
          {dashboard.backTo(name)}
        </ButtonLink>
      }
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{dashboard.subscribers}</h1>
          <p className={styles.lead}>{t.devices(subscriptions.length)}</p>
        </div>
        <ButtonLink href={`/dashboard/${site.slug}/send`} icon="bell">
          {dashboard.sendNotification}
        </ButtonLink>
      </div>
      {subscriptions.length > 0 ? (
        <ul className={styles.list}>
          {subscriptions.map((sub) => (
            <li key={sub.id}>
              <Card>
                <div className={styles.item}>
                  <p className={styles.itemTitle}>{sub.deviceInfo?.label ?? t.unknownDevice}</p>
                  <p className={styles.itemMeta}>
                    {[sub.geo?.city, sub.geo?.country].filter(Boolean).join(', ') || t.unknownLocation}
                  </p>
                  <p className={styles.itemMeta}>{t.subscribedOn(when.format(new Date(sub.createdAt)))}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className={styles.itemMeta}>{t.nobody}</p>
        </Card>
      )}
    </PageShell>
  );
}
