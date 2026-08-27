import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { getTenantBySlug, toTenantDTO } from '@/lib/tenant';
import { TenantSettingsForm } from '@/components/admin/TenantSettingsForm';

export default async function AdminTenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const userId = verifySessionToken(token);
  if (!userId) {
    redirect('/login');
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.ownerId.toHexString() !== userId) {
    notFound();
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{tenant.babyName}</h1>
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
