import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PublicPage } from '@/components/PublicPage';
import { siteAddress } from '@/lib/address';
import { addressEnv, deploymentEnv, vapidEnv } from '@/lib/env';
import { requestLang } from '@/lib/i18nNext';
import { publicPageViews } from '@/lib/publicPageView';
import { getSiteBySlug } from '@/lib/site';
import { SITE_PATHS, shareImageDay, shareText, siteIconUrl, siteShortName } from '@/lib/siteMeta';
import { getFont, googleFontsHref, rootTokenCss, themeStyle } from '@/lib/theme';
import { websiteAssetUrl } from '@/lib/websiteAssets';

export const dynamic = 'force-dynamic';

/** The metadata and the page read the same Site once per request. */
const loadSite = cache(getSiteBySlug);

type Props = { params: Promise<{ slug: string }> };

/**
 * How the Public page looks outside itself (see siteMeta.ts): the Site icon,
 * the name a home screen writes under it, and the link preview, in the
 * language the page itself speaks to whoever asks. Saved to an
 * iPhone's home screen, a Public page opens full screen, as an app of its own.
 * Next.js writes `capable` as `mobile-web-app-capable`; the `apple-` tag is
 * the one iOS has long read, so the page carries both.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await loadSite((await params).slug);
  if (!site) {
    return {};
  }
  const address = siteAddress(site.slug, addressEnv());
  const lang = await requestLang(site.languages);
  const name = siteShortName(site, lang);
  const { title, description } = shareText(site, lang);
  const image = {
    url: `${address}${SITE_PATHS.shareImage}?d=${shareImageDay(site.timezone)}&l=${lang}&v=${Date.parse(site.updatedAt)}`,
    width: 1200,
    height: 630,
    alt: title,
  };
  return {
    metadataBase: new URL(address),
    title: { absolute: title },
    description,
    applicationName: name,
    manifest: `${address}${SITE_PATHS.manifest}`,
    icons: {
      icon: site.icon
        ? [{ url: siteIconUrl(site, 'favicon', address), type: 'image/png', sizes: '32x32' }]
        : [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icon.svg', type: 'image/svg+xml' },
          ],
      apple: siteIconUrl(site, 'apple', address),
    },
    appleWebApp: { title: name, capable: true },
    openGraph: { title, description, url: address, siteName: 'Loading Baby', type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export default async function SitePage({ params }: Props) {
  const site = await loadSite((await params).slug);
  if (!site) {
    notFound();
  }

  const views = publicPageViews(site);

  return (
    <>
      <style>{rootTokenCss(themeStyle(site.theme))}</style>
      <link rel="stylesheet" href={googleFontsHref([getFont(site.theme.font)])} />
      <PublicPage
        views={views}
        initialLang={await requestLang(views.map((view) => view.lang))}
        slug={site.slug}
        vapidPublicKey={vapidEnv()?.publicKey}
        bornImageUrl={websiteAssetUrl('born-placeholder-v1.png', deploymentEnv().appEnv)}
      />
    </>
  );
}
