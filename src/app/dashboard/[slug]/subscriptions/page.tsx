import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { listSubscriptionsBySite } from '@/lib/subscription';
import styles from '../../dashboard.module.css';

export default async function SubscriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;

  const subscriptions = await listSubscriptionsBySite(site._id);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href={`/dashboard/${site.slug}`} variant="ghost" size="sm">
          Back to {name}
        </ButtonLink>
      }
    >
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>Subscribers</h1>
          <p className={styles.lead}>{subscriptions.length} device(s) subscribed.</p>
        </div>
        <ButtonLink href={`/dashboard/${site.slug}/send`} icon="bell">
          Send notification
        </ButtonLink>
      </div>
      {subscriptions.length > 0 ? (
        <ul className={styles.list}>
          {subscriptions.map((sub) => (
            <li key={sub._id.toHexString()}>
              <Card>
                <div className={styles.item}>
                  <p className={styles.itemTitle}>{sub.deviceInfo?.label ?? 'Unknown device'}</p>
                  <p className={styles.itemMeta}>
                    {[sub.geo?.city, sub.geo?.country].filter(Boolean).join(', ') || 'Location unknown'}
                  </p>
                  <p className={styles.itemMeta}>Subscribed {sub.createdAt.toLocaleString()}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <p className={styles.itemMeta}>
            Nobody yet. Share your page, and each device that turns on notifications shows up here.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
