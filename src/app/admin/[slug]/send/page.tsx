import { pageOwnedSite } from '@/lib/ownerAccessNext';
import { SendNotificationForm } from '@/components/admin/SendNotificationForm';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site: tenant } = await pageOwnedSite(slug);

  return (
    <div className="container">
      <h1>Send a notification</h1>
      <p className="muted">To everyone subscribed on {tenant.babyName || tenant.slug}&apos;s page.</p>
      <SendNotificationForm tenantSlug={tenant.slug} />
    </div>
  );
}
