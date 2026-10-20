import Link from 'next/link';
import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { toTenantDTO } from '@/lib/tenant';
import { TenantSettingsForm } from '@/components/admin/TenantSettingsForm';

export default async function AdminTenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site: tenant } = await pageOwnedSite(slug);

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{tenant.babyName || tenant.slug}</h1>
        <div className="row">
          <Link className="btn-secondary" href={`/admin/${tenant.slug}/subscriptions`}>
            Subscribers
          </Link>
          <Link className="btn-secondary" href={`/admin/${tenant.slug}/send`}>
            Send notification
          </Link>
        </div>
      </div>
      <TenantSettingsForm tenant={toTenantDTO(tenant)} />
    </div>
  );
}
