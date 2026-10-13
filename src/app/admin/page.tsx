import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ObjectId } from 'mongodb';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { listTenantsByOwner } from '@/lib/tenant';
import { tenantPublicUrl } from '@/lib/tenantUrl';

export default async function AdminPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = verifySessionToken(token);
  if (!userId) {
    redirect('/login');
  }

  const tenants = await listTenantsByOwner(new ObjectId(userId));

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
                <strong>{tenant.babyName}</strong>
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
