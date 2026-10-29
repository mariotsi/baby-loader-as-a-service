import { notFound } from 'next/navigation';
import { siteAddress, siteAddressPath } from '@/lib/address';
import { addressEnv } from '@/lib/env';
import { requestLang } from '@/lib/i18nNext';
import { getSiteBySlug } from '@/lib/site';
import { SITE_ICON_VARIANTS, siteIconUrl, siteShortName } from '@/lib/siteMeta';
import { getPalette } from '@/lib/theme';

/**
 * A Site's own manifest: what Android names and draws its Public page saved to
 * the home screen, with the Site icon, and opens it full screen as iOS does.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) {
    notFound();
  }
  const config = addressEnv();
  const address = siteAddress(site.slug, config);
  const path = siteAddressPath(site.slug, config);
  const name = siteShortName(site, await requestLang(site.languages));
  const background = getPalette(site.theme.palette).vars['--color-bg'];
  const icon = (variant: '192' | '512' | 'maskable') => ({
    src: siteIconUrl(site, variant, address),
    sizes: `${SITE_ICON_VARIANTS[variant].size}x${SITE_ICON_VARIANTS[variant].size}`,
    type: 'image/png',
    ...(SITE_ICON_VARIANTS[variant].maskable ? { purpose: 'maskable' } : {}),
  });
  return Response.json(
    {
      name,
      short_name: name,
      start_url: path,
      scope: path,
      display: 'standalone',
      background_color: background,
      theme_color: background,
      icons: [icon('192'), icon('512'), icon('maskable')],
    },
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=0, must-revalidate' } }
  );
}
