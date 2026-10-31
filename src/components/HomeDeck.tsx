'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { homeDeckCards, homeDeckImage } from '@/lib/homeDeck';
import type { Lang } from '@/lib/i18n';
import styles from './HomeDeck.module.css';

/** How long a card stays on top. */
const TURN_MS = 3500;
/** The cards behind the top one that show, plus one waiting out of sight to take the last place. */
const BEHIND = 3;
/** How far a swipe travels before it moves the deck, in CSS pixels. */
const SWIPE_PX = 40;

type DeckCopy = { label: string; previous: string; next: string; pause: string; play: string };

/**
 * The home page's pile of Public page pictures: every few seconds the top card
 * leaves and goes to the back. A swipe or the controls beneath move it by hand.
 * It rests under the pointer and while a control has focus, and anyone who
 * asks for reduced motion finds it paused. Screen readers hear the top card's
 * description when it changes, only while paused, as a turning deck would
 * interrupt them.
 */
export function HomeDeck({ lang, copy }: { lang: Lang; copy: DeckCopy }) {
  const [turn, setTurn] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPaused(true);
    }
  }, []);

  useEffect(() => {
    if (paused || held) {
      return;
    }
    const timer = setTimeout(() => setTurn(turn + 1), TURN_MS);
    return () => clearTimeout(timer);
  }, [turn, paused, held]);

  const cards = homeDeckCards(lang);
  const count = cards.length;
  const position = ((turn % count) + count) % count;

  function endSwipe(x: number) {
    if (swipeStart.current === null) {
      return;
    }
    const distance = x - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(distance) >= SWIPE_PX) {
      setTurn(turn + (distance < 0 ? 1 : -1));
    }
  }

  return (
    <section
      className={styles.deck}
      aria-roledescription="carousel"
      aria-label={copy.label}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div
        className={styles.pile}
        onPointerDown={(event) => {
          swipeStart.current = event.clientX;
        }}
        onPointerUp={(event) => endSwipe(event.clientX)}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        {cards.map((card, index) => {
          // -1 is the card that just left, 0 the top one.
          const place = ((((index - turn + 1) % count) + count) % count) - 1;
          if (place > BEHIND) {
            return null;
          }
          return (
            // biome-ignore lint/performance/noImgElement: the pictures are pre-sized WebP files in public/.
            <img
              key={card.slug}
              className={styles.card}
              data-place={place}
              style={{ '--place': place } as CSSProperties}
              src={homeDeckImage(card)}
              alt=""
              draggable={false}
              width={780}
              height={1280}
            />
          );
        })}
      </div>
      <VisuallyHidden>
        <span aria-live={paused ? 'polite' : 'off'}>{cards[position].alt}</span>
      </VisuallyHidden>
      <div className={styles.controls}>
        <Button variant="ghost" size="sm" icon="arrow-left" labelHidden onClick={() => setTurn(turn - 1)}>
          {copy.previous}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={paused ? 'play' : 'pause'}
          labelHidden
          onClick={() => setPaused(!paused)}
        >
          {paused ? copy.play : copy.pause}
        </Button>
        <Button variant="ghost" size="sm" icon="arrow-right" labelHidden onClick={() => setTurn(turn + 1)}>
          {copy.next}
        </Button>
        <span className={styles.counter} aria-hidden="true">
          {position + 1} / {count}
        </span>
      </div>
    </section>
  );
}
