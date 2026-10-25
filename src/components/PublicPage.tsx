'use client';

import { useEffect, useId, useState } from 'react';
import { Countdown } from '@/components/Countdown';
import { LanguageSwitcher, rememberLang } from '@/components/LanguageSwitcher';
import { MilestonePlace } from '@/components/MilestonePlace';
import { PushSubscribeButton } from '@/components/PushSubscribeButton';
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
 * or the Birth details.
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
    rememberLang(next);
    setLang(next);
  }

  return (
    <div className={styles.page}>
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
          <h1 className={styles.title}>{view.title}</h1>
          {view.sex ? <p className={styles.sex}>{view.sex}</p> : null}
          {view.waiting ? <p className={styles.lead}>{view.waiting.dueDate}</p> : null}
          {view.born ? <p className={styles.lead}>{view.born.bornOn}</p> : null}
          <div className={styles.cta}>
            <PushSubscribeButton slug={slug} lang={view.lang} vapidPublicKey={vapidPublicKey} t={view.push} />
          </div>
        </div>
        <div className={styles.aside}>
          {view.waiting ? <Countdown waiting={view.waiting} /> : null}
          {view.born ? <Born born={view.born} /> : null}
          {view.milestones ? <Milestones milestones={view.milestones} /> : null}
        </div>
      </main>
    </div>
  );
}

function Born({ born }: { born: NonNullable<PublicPageView['born']> }) {
  const lines = [born.weightLine, born.lengthLine].filter((line): line is string => !!line);
  return (
    <>
      {lines.length > 0 ? (
        <ul className={styles.stats}>
          {lines.map((line) => (
            <li key={line} className={styles.stat}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {born.message ? <p className={styles.message}>{born.message}</p> : null}
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
