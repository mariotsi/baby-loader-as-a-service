import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { getTenantBySlug } from '@/lib/tenant';
import { SendNotificationForm } from '@/components/admin/SendNotificationForm';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
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
      <h1>Send a notification</h1>
      <p className="muted">To everyone subscribed on {tenant.babyName}&apos;s page.</p>
      <SendNotificationForm tenantSlug={tenant.slug} />
    </div>
  );
}
