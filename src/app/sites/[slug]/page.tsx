import type { CSSProperties } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getSiteBySlug } from '@/lib/site';
import { themeStyle, googleFontsHref } from '@/lib/theme';
import { messages, pushButtonMessages } from '@/lib/messages';
import { negotiateLang, LANG_COOKIE, type Lang } from '@/lib/i18n';
import { daysUntil } from '@/lib/countdown';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PushSubscribeButton } from '@/components/PushSubscribeButton';

export const dynamic = 'force-dynamic';

async function resolveLang(siteLanguage: 'it' | 'en' | 'both'): Promise<Lang> {
  if (siteLanguage !== 'both') {
    return siteLanguage;
  }
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return negotiateLang(headerList.get('accept-language'), cookieStore.get(LANG_COOKIE)?.value);
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getSiteBySlug(slug);
  if (!site) {
    notFound();
  }

  const lang = await resolveLang(site.language);
  const t = messages[lang];
  const { birth } = site;
  const born = birth.born;
  const dateLocale = lang === 'it' ? 'it-IT' : 'en-US';

  const name = site.privacy.showName && site.babyName ? site.babyName : null;
  const title = born ? [t.bornTitle, name].filter(Boolean).join(' ') : `${t.waitingTitle} ${name ?? t.someone}`;
  const showSex = site.privacy.showSex && site.sex !== 'unknown';

  return (
    <div style={themeStyle(site.theme) as CSSProperties}>
      <link rel="stylesheet" href={googleFontsHref([site.theme.font])} />
      <div className="container">
        <div className="site-hero">
          <p className="site-tagline">{born ? t.bornTagline : t.waitingTagline}</p>
          <h1 className="site-title">{title}</h1>

          {showSex ? <p className="muted">{site.sex === 'female' ? t.sexFemale : t.sexMale}</p> : null}

          {!born && site.dueDate ? (
            <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
              <p className="muted">
                {t.duePrefix} {new Date(site.dueDate).toLocaleDateString(dateLocale, { dateStyle: 'long' })}
              </p>
              <CountdownDisplay dueIso={site.dueDate} t={t} />
            </div>
          ) : null}

          {birth.born ? (
            <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
              <p>{t.bornOn(new Date(birth.details.datetime).toLocaleString(dateLocale, { dateStyle: 'long', timeStyle: 'short' }))}</p>
              {birth.details.weightGrams || birth.details.lengthCm ? (
                <div className="row" style={{ justifyContent: 'center' }}>
                  {birth.details.weightGrams ? (
                    <span className="muted">
                      {t.weightLabel}: {birth.details.weightGrams} g
                    </span>
                  ) : null}
                  {birth.details.lengthCm ? (
                    <span className="muted">
                      {t.lengthLabel}: {birth.details.lengthCm} cm
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginTop: '2rem' }}>
            <PushSubscribeButton
              slug={site.slug}
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
              born={born}
              t={pushButtonMessages(t)}
            />
          </div>

          {site.language === 'both' && (
            <div style={{ marginTop: '2rem' }}>
              <LanguageSwitcher current={lang} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountdownDisplay({ dueIso, t }: { dueIso: string; t: (typeof messages)['en'] }) {
  const days = daysUntil(dueIso);
  if (days > 0) {
    return (
      <p className="countdown">
        {days} <span style={{ fontSize: '1.1rem', fontWeight: 400 }}>{t.daysLeft(days)}</span>
      </p>
    );
  }
  if (days === 0) {
    return <p className="countdown">{t.daysLeft(0)}</p>;
  }
  const late = Math.abs(days);
  return (
    <div>
      <p className="countdown">
        {late} <span style={{ fontSize: '1.1rem', fontWeight: 400 }}>{t.daysLate(late)}</span>
      </p>
      <p className="muted">{t.lateNote}</p>
    </div>
  );
}
