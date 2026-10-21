'use client';

import { useEffect, useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PushSubscribeButton } from '@/components/PushSubscribeButton';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';
import type { PublicPageView } from '@/lib/publicPageView';

/**
 * A Site's Public page, laid out from its views: one per language the Site
 * speaks, computed on the server. Switching language swaps the view in place
 * and remembers the choice in the language cookie for the next visit.
 */
export function PublicPage({
  views,
  initialLang,
  slug,
  vapidPublicKey,
}: {
  views: PublicPageView[];
  initialLang: Lang;
  slug: string;
  vapidPublicKey: string | undefined;
}) {
  const [lang, setLang] = useState(initialLang);
  const view = views.find((v) => v.lang === lang) ?? views[0];

  useEffect(() => {
    document.documentElement.lang = view.lang;
  }, [view.lang]);

  function chooseLang(next: Lang) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from Safari before 18.4, which Visitors still use.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setLang(next);
  }

  return (
    <div className="container">
      <div className="site-hero">
        <p className="site-tagline">{view.tagline}</p>
        <h1 className="site-title">{view.title}</h1>
        {view.sex ? <p className="muted">{view.sex}</p> : null}
        {view.waiting ? <Waiting waiting={view.waiting} /> : null}
        {view.born ? <Born born={view.born} /> : null}
        {view.milestones ? <Milestones milestones={view.milestones} /> : null}

        <div style={{ marginTop: '2rem' }}>
          <PushSubscribeButton slug={slug} vapidPublicKey={vapidPublicKey} t={view.push} />
        </div>

        {views.length > 1 ? (
          <div style={{ marginTop: '2rem' }}>
            <LanguageSwitcher langs={views.map((v) => v.lang)} current={view.lang} onChange={chooseLang} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Waiting({ waiting }: { waiting: NonNullable<PublicPageView['waiting']> }) {
  return (
    <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
      <p className="muted">{waiting.dueDate}</p>
      <p className="countdown">
        {waiting.count === null ? (
          waiting.unit
        ) : (
          <>
            {waiting.count} <span style={{ fontSize: '1.1rem', fontWeight: 400 }}>{waiting.unit}</span>
          </>
        )}
      </p>
      {waiting.lateNote ? <p className="muted">{waiting.lateNote}</p> : null}
    </div>
  );
}

function Born({ born }: { born: NonNullable<PublicPageView['born']> }) {
  return (
    <div className="stack" style={{ alignItems: 'center', marginTop: '1.5rem' }}>
      <p>{born.bornOn}</p>
      {born.weightLine || born.lengthLine ? (
        <div className="row" style={{ justifyContent: 'center' }}>
          {born.weightLine ? <span className="muted">{born.weightLine}</span> : null}
          {born.lengthLine ? <span className="muted">{born.lengthLine}</span> : null}
        </div>
      ) : null}
      {born.message ? <p>{born.message}</p> : null}
    </div>
  );
}

function Milestones({ milestones }: { milestones: NonNullable<PublicPageView['milestones']> }) {
  return (
    <section className="stack" style={{ marginTop: '2rem' }} aria-label={milestones.title}>
      <h2 className="muted">{milestones.title}</h2>
      <ul className="stack" style={{ listStyle: 'none', padding: 0 }}>
        {milestones.items.map((item) => (
          <li key={`${item.date}-${item.label}`}>
            <span className="muted">{item.date}</span> {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
