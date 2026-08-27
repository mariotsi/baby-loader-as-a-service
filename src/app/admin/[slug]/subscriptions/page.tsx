import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant';
import { listSubscriptionsByTenant } from '@/lib/subscription';

export default async function SubscriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
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

  const subscriptions = await listSubscriptionsByTenant(tenant._id);

  return (
    <div className="container">
      <h1>Subscribers</h1>
      <p className="muted">{subscriptions.length} device(s) subscribed.</p>
      <div className="stack">
        {subscriptions.map((sub) => (
          <div className="card" key={sub._id.toHexString()}>
            <div>{sub.deviceInfo?.label ?? 'Unknown device'}</div>
            <div className="muted">
              {[sub.geo?.city, sub.geo?.country].filter(Boolean).join(', ') || 'Location unknown'}
            </div>
            <div className="muted">Subscribed {sub.createdAt.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
