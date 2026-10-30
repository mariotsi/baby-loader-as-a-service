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
 *
 * Everything it shows comes from its props, so the Dashboard draws the same
 * page as a `preview` from Site settings not yet saved: it lays out to its
 * own width, leaves the document's language alone, and is inert, so the
 * notifications button shows and nobody can subscribe from it.
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
  preview = false,
}: {
  views: PublicPageView[];
  initialLang: Lang;
  slug: string;
  vapidPublicKey: string | undefined;
  bornImageUrl?: string;
  birthVideoUrl?: string;
  disableNotifications?: boolean;
  disableVideoAutoplay?: boolean;
  preview?: boolean;
}) {
  const [lang, setLang] = useState(initialLang);
  const [pillSlot, setPillSlot] = useState<HTMLElement | null>(null);
  const view = views.find((v) => v.lang === lang) ?? views[0];
  const noAutoplay = disableVideoAutoplay || preview;
  // A preview sits inside a Dashboard page, which has its own main landmark.
  const Main = preview ? 'div' : 'main';

  useEffect(() => {
    if (!preview) {
      document.documentElement.lang = view.lang;
    }
  }, [view.lang, preview]);

  function chooseLang(next: Lang) {
    rememberLang(next);
    setLang(next);
  }

  return (
    <div
      className={preview ? `${styles.page} ${styles.preview}` : styles.page}
      lang={preview ? view.lang : undefined}
      inert={preview}
      data-video-autoplay={noAutoplay ? 'disabled' : 'enabled'}
    >
      <JoyBackground />
      <PublicPageHeader views={views} view={view} onLang={chooseLang} />
      <Main className={styles.hero}>
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
              preview={preview}
              pillSlot={pillSlot}
            />
          </div>
        </div>
        <div className={styles.aside}>
          {view.waiting ? <Countdown waiting={view.waiting} /> : null}
          {view.born ? (
            <BirthVideo url={birthVideoUrl} lang={view.lang} slug={slug} disableAutoplay={noAutoplay} />
          ) : null}
          {view.born ? <Born born={view.born} imageUrl={bornImageUrl} /> : null}
          {view.milestones ? <Milestones milestones={view.milestones} /> : null}
        </div>
      </Main>
      <div ref={setPillSlot} className={styles.pillSlot} />
    </div>
  );
}

/** The Page name on the left and the Language switcher on the right, when the page has either. */
function PublicPageHeader({
  views,
  view,
  onLang,
}: {
  views: PublicPageView[];
  view: PublicPageView;
  onLang: (lang: Lang) => void;
}) {
  if (!view.pageName && views.length < 2) {
    return null;
  }
  return (
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
          onChange={onLang}
        />
      ) : null}
    </header>
  );
}

function PublicPageActions({
  view,
  slug,
  vapidPublicKey,
  disableNotifications,
  preview,
  pillSlot,
}: {
  view: PublicPageView;
  slug: string;
  vapidPublicKey: string | undefined;
  disableNotifications: boolean;
  preview: boolean;
  pillSlot: HTMLElement | null;
}) {
  if (preview) {
    // The button as a Visitor sees it first; the preview is inert, so nobody subscribes from it.
    return (
      <div className={styles.previewPush}>
        <Button variant="primary" icon="bell" fullWidth>
          {view.push.subscribe}
        </Button>
      </div>
    );
  }
  return (
    <>
      {disableNotifications ? null : (
        <PushSubscribeButton
          slug={slug}
          lang={view.lang}
          vapidPublicKey={vapidPublicKey}
          t={view.push}
          pillSlot={pillSlot}
          subscribedContent={<ShareButton view={view} />}
        />
      )}
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

function Born({ born, imageUrl }: { born: NonNullable<PublicPageView['born']>; imageUrl: string }) {
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
          <li key={`${item.date}-${item.label}`} className={styles.moment}>
            <span className={styles.emoji} aria-hidden="true">
              {item.emoji}
            </span>
            <div className={styles.memory}>
              <p className={styles.when}>{item.date}</p>
              <h3 className={styles.milestoneLabel}>{item.label}</h3>
              {item.place ? <MilestonePlace place={item.place} /> : null}
            </div>
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
