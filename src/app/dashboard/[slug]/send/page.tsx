import { SendNotificationForm } from '@/components/dashboard/SendNotificationForm';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { siteAddress } from '@/lib/address';
import { platformCopy } from '@/lib/copy/platform';
import { addressEnv } from '@/lib/env';
import { platformLang } from '@/lib/i18nNext';
import { siteNotificationIcon } from '@/lib/notificationDelivery';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { siteSettingsOf } from '@/lib/siteSettings';
import { countSubscriptionsBySite } from '@/lib/subscription';
import styles from '../../dashboard.module.css';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const name = site.babyName || site.slug;
  const { dashboard, send } = platformCopy[await platformLang()];
  const address = siteAddress(site.slug, addressEnv());
  const subscribers = await countSubscriptionsBySite(site.id);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href={`/dashboard/${site.slug}`} variant="ghost" size="sm" icon="arrow-left">
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
      <SendNotificationForm
        slug={site.slug}
        site={siteSettingsOf(site)}
        icon={siteNotificationIcon(site, address)}
        host={address.replace(/^https?:\/\//, '')}
        subscribers={subscribers}
        subscriptionsHref={`/dashboard/${site.slug}/subscriptions`}
        born={site.birth.born}
      />
    </PageShell>
  );
}
