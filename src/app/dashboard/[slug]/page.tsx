import { SiteEditor } from '@/components/dashboard/SiteEditor';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { StatusMessage } from '@/components/ui/StatusMessage';
import { siteAddress } from '@/lib/address';
import { mediaFromPageOrigin } from '@/lib/birthMedia';
import { platformCopy } from '@/lib/copy/platform';
import { addressEnv, deploymentEnv } from '@/lib/env';
import { platformLang } from '@/lib/i18nNext';
import { unfinishedBirth } from '@/lib/notificationDelivery';
import { listNotifications } from '@/lib/notificationLog';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { toSiteDTO } from '@/lib/site';
import { FONTS, googleFontsHref } from '@/lib/theme';
import { websiteAssetUrl } from '@/lib/websiteAssets';
import styles from '../dashboard.module.css';

export default async function DashboardSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const address = siteAddress(site.slug, addressEnv());
  const t = platformCopy[await platformLang()].dashboard;
  const birthToFinish = unfinishedBirth(await listNotifications(site.id), site);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href="/dashboard" variant="ghost" size="sm" icon="arrow-left">
          {t.yourSites}
        </ButtonLink>
      }
    >
      {/* The Font picker writes in every Font. */}
      <link rel="stylesheet" href={googleFontsHref(FONTS)} />
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{site.babyName || site.slug}</h1>
          <p className={styles.lead}>
            {t.pageIsAt}{' '}
            <a href={address} target="_blank" rel="noreferrer">
              {address.replace(/^https?:\/\//, '')}
            </a>
            .
            <br />
            {t.addressStays}
          </p>
        </div>
        <Stack direction="row" gap={2}>
          <ButtonLink href={`/dashboard/${site.slug}/subscriptions`} size="phoneSm">
            {t.subscribers}
          </ButtonLink>
          <ButtonLink href={`/dashboard/${site.slug}/notifications`} size="phoneSm">
            {t.notifications}
          </ButtonLink>
          <ButtonLink href={`/dashboard/${site.slug}/send`} icon="bell" size="phoneSm">
            {t.sendNotification}
          </ButtonLink>
        </Stack>
      </div>
      {birthToFinish ? (
        <StatusMessage tone="info" fullWidth className={styles.notice}>
          {t.unfinishedBirth} <a href={`/dashboard/${site.slug}/notifications`}>{t.finishIt}</a>
        </StatusMessage>
      ) : null}
      <SiteEditor
        mediaPreviewSlug={mediaFromPageOrigin(deploymentEnv().appEnv) ? site.slug : undefined}
        site={toSiteDTO(site)}
        timeZones={Intl.supportedValuesOf('timeZone')}
        address={address}
        bornPlaceholderUrl={websiteAssetUrl('born-placeholder-v1.png', deploymentEnv().appEnv)}
      />
    </PageShell>
  );
}
