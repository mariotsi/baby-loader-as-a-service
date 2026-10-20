import Link from 'next/link';
import { pageUser } from '@/lib/ownerAccessNext';
import { listTenantsByOwner } from '@/lib/tenant';
import { tenantPublicUrl } from '@/lib/tenantUrl';

export default async function AdminPage() {
  const tenants = await listTenantsByOwner(await pageUser());

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Your sites</h1>
        <Link className="btn" href="/onboarding">
          + New site
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="muted">You haven&apos;t created a site yet.</p>
      ) : (
        <div className="stack">
          {tenants.map((tenant) => (
            <div className="card row" key={tenant.slug} style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{tenant.babyName || tenant.slug}</strong>
                <div className="muted">{tenantPublicUrl(tenant.slug).replace(/^https?:\/\//, '')}</div>
              </div>
              <div className="row">
                <a className="btn-secondary" href={tenantPublicUrl(tenant.slug)} target="_blank" rel="noreferrer">
                  View
                </a>
                <Link className="btn" href={`/admin/${tenant.slug}`}>
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
