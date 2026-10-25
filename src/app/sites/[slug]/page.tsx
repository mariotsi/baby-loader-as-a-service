import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { PublicPage } from '@/components/PublicPage';
import { LANG_COOKIE, type Lang, negotiateLang } from '@/lib/i18n';
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

/** The Visitor's language among the Site's: the cookie first, then Accept-Language, then the fallback. */
async function initialLang(langs: Lang[]): Promise<Lang> {
  if (langs.length === 1) {
    return langs[0];
  }
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return negotiateLang(headerList.get('accept-language'), cookieStore.get(LANG_COOKIE)?.value, langs);
}

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
        initialLang={await initialLang(views.map((view) => view.lang))}
        slug={site.slug}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
      />
    </>
  );
}
