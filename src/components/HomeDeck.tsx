'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { HOME_DECK_CARDS, homeDeckImage } from '@/lib/homeDeck';
import styles from './HomeDeck.module.css';

/** How long a card stays on top. */
const TURN_MS = 3500;
/** The cards behind the top one that show, plus one waiting out of sight to take the last place. */
const BEHIND = 3;

/**
 * The home page's pile of Public page pictures: every few seconds the top card
 * leaves and goes to the back. It rests while the pointer is on it, in a
 * hidden tab, and for anyone who asks for reduced motion. The pictures only
 * decorate the pitch beside them, so screen readers skip the whole pile.
 */
export function HomeDeck() {
  const [turn, setTurn] = useState(0);
  const resting = useRef<boolean>(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timer = setInterval(() => {
      if (!resting.current && !reducedMotion.matches && !document.hidden) {
        setTurn((current) => current + 1);
      }
    }, TURN_MS);
    return () => clearInterval(timer);
  }, []);

  const count = HOME_DECK_CARDS.length;
  return (
    <div
      className={styles.deck}
      aria-hidden="true"
      onPointerEnter={() => {
        resting.current = true;
      }}
      onPointerLeave={() => {
        resting.current = false;
      }}
    >
      {HOME_DECK_CARDS.map((card, index) => {
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
            width={780}
            height={1280}
          />
        );
      })}
    </div>
  );
}
