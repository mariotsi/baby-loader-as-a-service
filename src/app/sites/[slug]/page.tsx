import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { PublicPage } from '@/components/PublicPage';
import { LANG_COOKIE, type Lang, negotiateLang } from '@/lib/i18n';
import { publicPageViews } from '@/lib/publicPageView';
import { getSiteBySlug } from '@/lib/site';
import { googleFontsHref, themeStyle } from '@/lib/theme';

export const dynamic = 'force-dynamic';

/** The Visitor's language among the Site's: the cookie first, then Accept-Language. */
async function initialLang(langs: Lang[]): Promise<Lang> {
  if (langs.length === 1) {
    return langs[0];
  }
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  const lang = negotiateLang(headerList.get('accept-language'), cookieStore.get(LANG_COOKIE)?.value);
  return langs.includes(lang) ? lang : langs[0];
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) {
    notFound();
  }

  const views = publicPageViews(site);

  return (
    <div style={themeStyle(site.theme) as CSSProperties}>
      <link rel="stylesheet" href={googleFontsHref([site.theme.font])} />
      <PublicPage
        views={views}
        initialLang={await initialLang(views.map((view) => view.lang))}
        slug={site.slug}
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
      />
    </div>
  );
}
