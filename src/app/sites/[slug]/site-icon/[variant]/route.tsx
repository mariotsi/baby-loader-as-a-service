import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/site';
import { siteIconImage } from '@/lib/siteImages';
import { isSiteIconVariant, siteIconUrl } from '@/lib/siteMeta';

/**
 * One image of a Site's emoji icon. Its URL changes with the emoji and the
 * Palette (see siteIconUrl), so a version is cached for good. A Site with the
 * loading baby is sent to the Platform's file, for a link saved before the
 * Owner went back to it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; variant: string }> }) {
  const { slug, variant } = await params;
  const site = await getSiteBySlug(slug);
  if (!site || !isSiteIconVariant(variant)) {
    notFound();
  }
  if (!site.icon) {
    // Relative, so the browser stays on the host it asked: the Site's subdomain, or the Platform's in path mode.
    return new Response(null, { status: 307, headers: { Location: siteIconUrl(site, variant, '') } });
  }
  return siteIconImage(site, variant, { 'Cache-Control': 'public, max-age=31536000, immutable' });
}
