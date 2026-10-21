import { SendNotificationForm } from '@/components/admin/SendNotificationForm';
import { pageOwnedSite } from '@/lib/ownerAccessNext';

export default async function SendPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site } = await pageOwnedSite(slug);

  return (
    <div className="container">
      <h1>Send a notification</h1>
      <p className="muted">To everyone subscribed on {site.babyName || site.slug}&apos;s page.</p>
      <SendNotificationForm slug={site.slug} />
    </div>
  );
}
