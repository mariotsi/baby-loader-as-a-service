import Link from 'next/link';
import { pageUser } from '@/lib/ownerAccessNext';
import { listSitesByOwner } from '@/lib/site';
import { siteAddress } from '@/lib/address';

export default async function AdminPage() {
  const sites = await listSitesByOwner(await pageUser());

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Your sites</h1>
        <Link className="btn" href="/onboarding">
          + New site
        </Link>
      </div>

      {sites.length === 0 ? (
        <p className="muted">You haven&apos;t created a site yet.</p>
      ) : (
        <div className="stack">
          {sites.map((site) => (
            <div className="card row" key={site.slug} style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{site.babyName || site.slug}</strong>
                <div className="muted">{siteAddress(site.slug).replace(/^https?:\/\//, '')}</div>
              </div>
              <div className="row">
                <a className="btn-secondary" href={siteAddress(site.slug)} target="_blank" rel="noreferrer">
                  View
                </a>
                <Link className="btn" href={`/admin/${site.slug}`}>
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
