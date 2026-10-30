'use client';

import { useEffect, useId, useState } from 'react';
import { BirthReveal } from '@/components/BirthReveal';
import { Countdown } from '@/components/Countdown';
import { LanguageSwitcher, rememberLang } from '@/components/LanguageSwitcher';
import { MilestonePlace } from '@/components/MilestonePlace';
import { PushSubscribeButton } from '@/components/PushSubscribeButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { JoyBackground } from '@/components/ui/JoyBackground';
import type { Lang } from '@/lib/i18n';
import type { PublicPageView } from '@/lib/publicPageView';
import styles from './PublicPage.module.css';

/**
 * A Site's Public page, laid out from its views: one per language the Site
 * speaks, computed on the server. Switching language swaps the view in place
 * and remembers the choice in the language cookie for the next visit.
 *
 * The header carries the Owner's Page name on the left and the Language
 * switcher on the right. On a phone everything stacks in one centred column;
 * on a wide screen the name and the call to action sit beside the Countdown
 * or the Birth details. Once notifications are on, their pill leaves the call
 * to action for the end of the page, after all the content: centred on a
 * phone, on the right on a wide screen.
 */
export function PublicPage({
  views,
  initialLang,
  slug,
  vapidPublicKey,
  bornImageUrl = '/website-assets/born-placeholder-v1.png',
  birthVideoUrl,
  disableNotifications = false,
  disableVideoAutoplay = false,
}: {
  views: PublicPageView[];
  initialLang: Lang;
  slug: string;
  vapidPublicKey: string | undefined;
  bornImageUrl?: string;
  birthVideoUrl?: string;
  disableNotifications?: boolean;
  disableVideoAutoplay?: boolean;
}) {
  const [lang, setLang] = useState(initialLang);
  const [pillSlot, setPillSlot] = useState<HTMLElement | null>(null);
  const view = views.find((v) => v.lang === lang) ?? views[0];

  useEffect(() => {
    document.documentElement.lang = view.lang;
  }, [view.lang]);

  function chooseLang(next: Lang) {
    rememberLang(next);
    setLang(next);
  }

  return (
    <div className={styles.page} data-video-autoplay={disableVideoAutoplay ? 'disabled' : 'enabled'}>
      <JoyBackground />
      {view.pageName || views.length > 1 ? (
        <header className={styles.header}>
          {view.pageName ? (
            <p className={styles.pageName}>
              <Icon name="heart" className={styles.heart} />
              {view.pageName}
            </p>
          ) : null}
          {views.length > 1 ? (
            <LanguageSwitcher
              langs={views.map((v) => v.lang)}
              current={view.lang}
              label={view.languageLabel}
              onChange={chooseLang}
            />
          ) : null}
        </header>
      ) : null}
      <main className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.tagline}>{view.tagline}</p>
          <h1 className={styles.title}>
            <span className={styles.titleLead}>{view.titleLead}</span> {view.titleName}
          </h1>
          {view.sex ? <p className={styles.sex}>{view.sex}</p> : null}
          {view.waiting ? <p className={styles.lead}>{view.waiting.dueDate}</p> : null}
          <div className={styles.cta}>
            <PublicPageActions
              view={view}
              slug={slug}
              vapidPublicKey={vapidPublicKey}
              disableNotifications={disableNotifications}
              pillSlot={pillSlot}
            />
          </div>
        </div>
        <div className={styles.aside}>
          {view.waiting ? <Countdown waiting={view.waiting} /> : null}
          {view.born ? (
            <BirthVideo url={birthVideoUrl} lang={view.lang} slug={slug} disableAutoplay={disableVideoAutoplay} />
          ) : null}
          {view.born ? <Born born={view.born} view={view} imageUrl={bornImageUrl} /> : null}
          {view.milestones ? <Milestones milestones={view.milestones} /> : null}
        </div>
      </main>
      <div ref={setPillSlot} className={styles.pillSlot} />
    </div>
  );
}

function PublicPageActions({
  view,
  slug,
  vapidPublicKey,
  disableNotifications,
  pillSlot,
}: {
  view: PublicPageView;
  slug: string;
  vapidPublicKey: string | undefined;
  disableNotifications: boolean;
  pillSlot: HTMLElement | null;
}) {
  return (
    <>
      {disableNotifications ? null : (
        <PushSubscribeButton
          slug={slug}
          lang={view.lang}
          vapidPublicKey={vapidPublicKey}
          t={view.push}
          pillSlot={pillSlot}
        />
      )}
      {view.waiting ? <ShareButton view={view} /> : null}
    </>
  );
}

function ShareButton({ view }: { view: PublicPageView }) {
  const [shareMessage, setShareMessage] = useState('');

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: view.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copied');
      }
    } catch {
      setShareMessage('');
    }
  }

  return (
    <>
      <Button onClick={share}>{view.share}</Button>
      {shareMessage ? (
        <p role="status" className={styles.shareMessage}>
          {shareMessage}
        </p>
      ) : null}
    </>
  );
}

function Born({
  born,
  view,
  imageUrl,
}: {
  born: NonNullable<PublicPageView['born']>;
  view: PublicPageView;
  imageUrl: string;
}) {
  return (
    <>
      {/* biome-ignore lint/performance/noImgElement: R2 serves the pre-sized website asset directly. */}
      <img className={styles.bornImage} src={imageUrl} alt="" width={750} height={900} />
      <p className={styles.lead}>{born.bornOn}</p>
      <div className={styles.age}>
        <span className={styles.ageNumber}>{born.age}</span>
        <span className={styles.ageLabel}>{born.ageLabel}</span>
      </div>
      {born.stats.length > 0 ? (
        <ul className={styles.stats}>
          {born.stats.map((stat) => (
            <li key={stat.label} className={styles.stat}>
              <span className={styles.statLabel}>{stat.label}</span>
              <span className={styles.statValue}>{stat.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {born.message ? (
        <Card>
          <p className={styles.message}>{born.message}</p>
        </Card>
      ) : null}
      <ShareButton view={view} />
    </>
  );
}

function Milestones({ milestones }: { milestones: NonNullable<PublicPageView['milestones']> }) {
  const headingId = useId();
  return (
    <section className={styles.milestones} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.milestonesTitle}>
        {milestones.title}
      </h2>
      <ol className={styles.timeline}>
        {milestones.items.map((item) => (
          <li key={`${item.date}-${item.label}`}>
            <span className={styles.emoji} aria-hidden="true">
              {item.emoji}
            </span>
            <span className={styles.when}>{item.date}</span> {item.label}
            {item.place ? <MilestonePlace place={item.place} /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function BirthVideo({
  url,
  lang,
  slug,
  disableAutoplay,
}: {
  url?: string;
  lang: Lang;
  slug: string;
  disableAutoplay: boolean;
}) {
  const [revealOpen, setRevealOpen] = useState(false);
  useEffect(() => {
    if (!url || disableAutoplay) {
      return;
    }
    const key = `birth-reveal:${slug}:${url}`;
    try {
      if (localStorage.getItem(key)) {
        return;
      }
      localStorage.setItem(key, 'seen');
    } catch {
      return;
    }
    setRevealOpen(true);
  }, [url, disableAutoplay, slug]);

  if (!url) {
    return null;
  }
  return (
    <>
      <Button onClick={() => setRevealOpen(true)}>
        {lang === 'it' ? 'Riguarda il benvenuto' : 'Replay the welcome'}
      </Button>
      {revealOpen ? <BirthReveal url={url} lang={lang} onClose={() => setRevealOpen(false)} /> : null}
    </>
  );
}
