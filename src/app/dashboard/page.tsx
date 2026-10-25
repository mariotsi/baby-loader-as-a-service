import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { siteAddress } from '@/lib/address';
import { pageUser } from '@/lib/ownerAccessNext';
import { listSitesByOwner } from '@/lib/site';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  const sites = await listSitesByOwner(await pageUser());

  return (
    <PageShell width="wide">
      <div className={styles.header}>
        <h1 className={styles.title}>Your sites</h1>
        <ButtonLink href="/onboarding" variant="primary" icon="plus">
          New site
        </ButtonLink>
      </div>

      {sites.length === 0 ? (
        <Card title="Start your first page" description="It takes a minute, and everyone can start counting with you.">
          <div>
            <ButtonLink href="/onboarding" icon="sparkles">
              Create your page
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {sites.map((site) => {
            const name = site.babyName || site.slug;
            const address = siteAddress(site.slug);
            return (
              <li key={site.slug}>
                <Card>
                  <div className={styles.item}>
                    <p className={styles.itemTitle}>{name}</p>
                    <p className={styles.itemMeta}>{address.replace(/^https?:\/\//, '')}</p>
                    <Stack direction="row" gap={2}>
                      <ButtonLink href={`/dashboard/${site.slug}`} size="sm" aria-label={`Manage ${name}`}>
                        Manage
                      </ButtonLink>
                      <ButtonLink
                        href={address}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${name}'s page, opens in a new tab`}
                        variant="ghost"
                        size="sm"
                        icon="external"
                        iconPosition="end"
                      >
                        View
                      </ButtonLink>
                    </Stack>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
