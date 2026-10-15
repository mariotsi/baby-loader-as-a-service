import type { CSSProperties } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTenantBySlug } from '@/lib/tenant';
import { themeStyle, googleFontsHref } from '@/lib/theme';
import { messages, pushButtonMessages } from '@/lib/messages';
import { negotiateLang, LANG_COOKIE, type Lang } from '@/lib/i18n';
import { daysUntil } from '@/lib/countdown';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PushSubscribeButton } from '@/components/PushSubscribeButton';

export const dynamic = 'force-dynamic';

async function resolveLang(tenantLanguage: 'it' | 'en' | 'both'): Promise<Lang> {
  if (tenantLanguage !== 'both') {
    return tenantLanguage;
  }
  const [headerList, cookieStore] = await Promise.all([headers(), cookies()]);
  return negotiateLang(headerList.get('accept-language'), cookieStore.get(LANG_COOKIE)?.value);
}

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    notFound();
  }

  const lang = await resolveLang(tenant.language);
  const t = messages[lang];
  const born = !!tenant.birthDatetime;
  const dateLocale = lang === 'it' ? 'it-IT' : 'en-US';

  const showName = tenant.privacy.showName;
  const showSex = tenant.privacy.showSex && tenant.sex !== 'unknown';

  return (
    <div style={themeStyle(tenant.theme) as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- curated, per-tenant font chosen from a fixed list */}
      <link rel="stylesheet" href={googleFontsHref([tenant.theme.font])} />
      <div className="container">
        <div className="tenant-hero">
          <p className="tenant-tagline">{born ? t.bornTagline : t.waitingTagline}</p>
          <h1 className="tenant-title">
            {born ? t.bornTitle : t.waitingTitle}
            {showName ? ` ${tenant.babyName}` : ''}
          </h1>

          {showSex && <p className="muted">{tenant.sex === 'female' ? t.sexFemale : t.sexMale}</p>}

          {!born && tenant.dueDate && (
            <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
              <p className="muted">
                {t.duePrefix} {new Date(tenant.dueDate).toLocaleDateString(dateLocale, { dateStyle: 'long' })}
              </p>
              <CountdownDisplay dueIso={tenant.dueDate} t={t} />
            </div>
          )}

          {born && tenant.birthDatetime && (
            <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
              <p>{t.bornOn(new Date(tenant.birthDatetime).toLocaleString(dateLocale, { dateStyle: 'long', timeStyle: 'short' }))}</p>
              {(tenant.weight || tenant.lengthCm) && (
                <div className="row" style={{ justifyContent: 'center' }}>
                  {tenant.weight ? (
                    <span className="muted">
                      {t.weightLabel}: {tenant.weight} g
                    </span>
                  ) : null}
                  {tenant.lengthCm ? (
                    <span className="muted">
                      {t.lengthLabel}: {tenant.lengthCm} cm
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <PushSubscribeButton
              tenantSlug={tenant.slug}
              vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
              born={born}
              t={pushButtonMessages(t)}
            />
          </div>

          {tenant.language === 'both' && (
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
