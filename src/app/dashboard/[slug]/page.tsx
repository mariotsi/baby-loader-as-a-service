import { SiteSettingsForm } from '@/components/dashboard/SiteSettingsForm';
import { ButtonLink } from '@/components/ui/Button';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { siteAddress } from '@/lib/address';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { toSiteDTO } from '@/lib/site';
import { FONTS, googleFontsHref } from '@/lib/theme';
import styles from '../dashboard.module.css';

export default async function DashboardSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const address = siteAddress(site.slug);

  return (
    <PageShell
      width="wide"
      nav={
        <ButtonLink href="/dashboard" variant="ghost" size="sm">
          Your sites
        </ButtonLink>
      }
    >
      {/* The Font picker writes in every Font. */}
      <link rel="stylesheet" href={googleFontsHref(FONTS)} />
      <div className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{site.babyName || site.slug}</h1>
          <p className={styles.lead}>
            Your page is at{' '}
            <a href={address} target="_blank" rel="noreferrer">
              {address.replace(/^https?:\/\//, '')}
            </a>
            . The address stays the same once the Site exists.
          </p>
        </div>
        <Stack direction="row" gap={2}>
          <ButtonLink href={`/dashboard/${site.slug}/subscriptions`}>Subscribers</ButtonLink>
          <ButtonLink href={`/dashboard/${site.slug}/send`} icon="bell">
            Send notification
          </ButtonLink>
        </Stack>
      </div>
      <SiteSettingsForm site={toSiteDTO(site)} timeZones={Intl.supportedValuesOf('timeZone')} />
    </PageShell>
  );
}
