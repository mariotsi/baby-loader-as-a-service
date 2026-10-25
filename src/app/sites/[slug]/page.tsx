import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicPage } from '@/components/PublicPage';
import { vapidEnv } from '@/lib/env';
import { requestLang } from '@/lib/i18nNext';
import { publicPageViews } from '@/lib/publicPageView';
import { getSiteBySlug } from '@/lib/site';
import { getFont, googleFontsHref, rootTokenCss, themeStyle } from '@/lib/theme';

export const dynamic = 'force-dynamic';

/**
 * Saved to an iPhone's home screen, a Public page opens full screen, as an
 * app of its own. Next.js writes `capable` as `mobile-web-app-capable`; the
 * `apple-` tag is the one iOS has long read, so the page carries both.
 */
export const metadata: Metadata = {
  appleWebApp: { title: 'Loading Baby', capable: true },
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
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
      />
    </>
  );
}
