'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import {
  isNewDeploy,
  PERIODIC_CHECK_INTERVAL_MS,
  pullOffset,
  pullReloads,
  RESUME_CHECK_INTERVAL_MS,
} from '@/lib/appUpdate';
import styles from './KeepCurrent.module.css';

/** Whether the page runs as an app saved to the home screen, without the browser around it. */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Whether a touch on `target` would scroll something already scrolled, or
 * lands in an open dialog, so pulling down there scrolls it instead of
 * reloading the page.
 */
function scrollsElsewhere(target: EventTarget | null): boolean {
  if (window.scrollY > 0 || document.querySelector('dialog[open]')) {
    return true;
  }
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.scrollTop > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps an open Public page current (see appUpdate.ts), so its Countdown
 * moves on to the next day and a birth announced meanwhile shows. While the
 * page is in view, every few minutes and each time it comes back to the
 * front, it asks /api/version which commit is live: when that is not the one
 * that rendered the page it reloads, and otherwise it fetches the page's
 * content again in place, keeping the chosen language and the scroll. Saved
 * to the home screen, where the browser offers no way to reload, pulling
 * down from the top of the page reloads it too, as in Safari.
 */
export function KeepCurrent({ commit }: { commit: string | null }) {
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);
  const [offset, setOffset] = useState(0);
  const [reloading, setReloading] = useState(false);
  const lastCheck = useRef(Date.now());

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  useEffect(() => {
    async function checkForUpdate() {
      if (document.visibilityState !== 'visible' || Date.now() - lastCheck.current < RESUME_CHECK_INTERVAL_MS) {
        return;
      }
      lastCheck.current = Date.now();
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const live = res.ok ? ((await res.json()) as { commit?: string | null }).commit : undefined;
        if (isNewDeploy(commit, live)) {
          window.location.reload();
          return;
        }
      } catch {
        // Offline: show what there is, and try again on the next return.
      }
      router.refresh();
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        void checkForUpdate();
      }
    }
    const timer = window.setInterval(checkForUpdate, PERIODIC_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [commit, router]);

  useEffect(() => {
    if (!standalone) {
      return;
    }
    let startY: number | null = null;
    let current = 0;
    function onTouchStart(event: TouchEvent) {
      startY = event.touches.length === 1 && !scrollsElsewhere(event.target) ? event.touches[0].clientY : null;
    }
    function onTouchMove(event: TouchEvent) {
      if (startY === null) {
        return;
      }
      current = pullOffset(event.touches[0].clientY - startY);
      setOffset(current);
    }
    function onTouchEnd() {
      if (startY === null) {
        return;
      }
      startY = null;
      if (pullReloads(current)) {
        setReloading(true);
        window.location.reload();
        return;
      }
      current = 0;
      setOffset(0);
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [standalone]);

  if (!standalone || (offset === 0 && !reloading)) {
    return null;
  }
  return (
    <div
      className={styles.indicator}
      data-pulling={reloading ? undefined : ''}
      data-ready={pullReloads(offset) ? '' : undefined}
      style={{ '--pull': `${offset}px` } as React.CSSProperties}
    >
      <Spinner size="lg" tone="brand" />
    </div>
  );
}
