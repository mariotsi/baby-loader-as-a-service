import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { Stack } from '@/components/ui/Stack';
import { siteAddress } from '@/lib/address';
import { platformCopy } from '@/lib/copy/platform';
import { addressEnv } from '@/lib/env';
import { platformLang } from '@/lib/i18nNext';
import { pageUser } from '@/lib/ownerAccessNext';
import { listSitesByOwner } from '@/lib/site';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  const sites = await listSitesByOwner(await pageUser());
  const t = platformCopy[await platformLang()].dashboard;

  return (
    <PageShell width="wide">
      <div className={styles.header}>
        <h1 className={styles.title}>{t.yourSites}</h1>
        <ButtonLink href="/onboarding" variant="primary" icon="plus">
          {t.newSite}
        </ButtonLink>
      </div>

      {sites.length === 0 ? (
        <Card title={t.firstPage} description={t.firstPageDescription}>
          <div>
            <ButtonLink href="/onboarding" icon="sparkles">
              {t.createPage}
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {sites.map((site) => {
            const name = site.babyName || site.slug;
            const address = siteAddress(site.slug, addressEnv());
            return (
              <li key={site.slug}>
                <Card>
                  <div className={styles.item}>
                    <p className={styles.itemTitle}>{name}</p>
                    <p className={styles.itemMeta}>{address.replace(/^https?:\/\//, '')}</p>
                    <Stack direction="row" gap={2}>
                      <ButtonLink href={`/dashboard/${site.slug}`} size="sm" aria-label={t.manageName(name)}>
                        {t.manage}
                      </ButtonLink>
                      <ButtonLink
                        href={address}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={t.viewName(name)}
                        variant="ghost"
                        size="sm"
                        icon="external"
                        iconPosition="end"
                      >
                        {t.view}
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
