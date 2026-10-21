import Link from 'next/link';
import { SiteSettingsForm } from '@/components/admin/SiteSettingsForm';
import { siteAddress } from '@/lib/address';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { toSiteDTO } from '@/lib/site';

export default async function AdminSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);
  const address = siteAddress(site.slug);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{site.babyName || site.slug}</h1>
        <div className="row">
          <Link className="btn-secondary" href={`/admin/${site.slug}/subscriptions`}>
            Subscribers
          </Link>
          <Link className="btn-secondary" href={`/admin/${site.slug}/send`}>
            Send notification
          </Link>
        </div>
      </div>
      <p className="muted">
        Address (the Slug is fixed once the Site exists):{' '}
        <a href={address} target="_blank" rel="noreferrer">
          {address.replace(/^https?:\/\//, '')}
        </a>
      </p>
      <SiteSettingsForm site={toSiteDTO(site)} timeZones={Intl.supportedValuesOf('timeZone')} />
    </div>
  );
}
