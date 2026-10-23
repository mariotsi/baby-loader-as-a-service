'use client';

import { useEffect, useRef } from 'react';
import styles from './JoyBackground.module.css';

/**
 * The Palette's three decoration colors as soft circles behind the content.
 * They drift at different depths as the page scrolls, and lean toward the
 * mouse or the finger touching the screen, which gives the page depth; when
 * the finger lifts they settle back. Under `prefers-reduced-motion` they stay
 * still; browsers without scroll-driven animations skip the scroll drift.
 *
 * Place it first inside a `position: relative` container that clips its
 * overflow; the content after it paints on top.
 */
export function JoyBackground() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    // Follows the preference live: turning on reduced motion mid-visit stops the parallax at once.
    const motionAllowed = window.matchMedia('(prefers-reduced-motion: no-preference)');
    let frame = 0;

    function leanToward(x: number, y: number) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root?.style.setProperty('--pointer-x', ((x / window.innerWidth) * 2 - 1).toFixed(3));
        root?.style.setProperty('--pointer-y', ((y / window.innerHeight) * 2 - 1).toFixed(3));
      });
    }
    function settle() {
      cancelAnimationFrame(frame);
      root?.style.removeProperty('--pointer-x');
      root?.style.removeProperty('--pointer-y');
    }
    function onPointer(event: PointerEvent) {
      leanToward(event.clientX, event.clientY);
    }
    // A browser stops sending pointer events once a touch starts scrolling the page; touch events keep coming.
    function onTouchMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) {
        leanToward(touch.clientX, touch.clientY);
      }
    }
    const listeners = [
      ['pointerdown', onPointer],
      ['pointermove', onPointer],
      ['touchmove', onTouchMove],
      ['touchend', settle],
      ['touchcancel', settle],
    ] as const;

    function stop() {
      for (const [type, listener] of listeners) {
        window.removeEventListener(type, listener as EventListener);
      }
      settle();
    }
    function sync() {
      stop();
      if (motionAllowed.matches) {
        for (const [type, listener] of listeners) {
          window.addEventListener(type, listener as EventListener, { passive: true });
        }
      }
    }
    sync();
    motionAllowed.addEventListener('change', sync);
    return () => {
      motionAllowed.removeEventListener('change', sync);
      stop();
    };
  }, []);

  return (
    <div ref={ref} className={styles.root} aria-hidden="true">
      <span className={`${styles.layer} ${styles.one}`}>
        <span className={styles.blob} />
      </span>
      <span className={`${styles.layer} ${styles.two}`}>
        <span className={styles.blob} />
      </span>
      <span className={`${styles.layer} ${styles.three}`}>
        <span className={styles.blob} />
      </span>
    </div>
  );
}
