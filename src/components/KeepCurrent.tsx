'use client';

import { useEffect } from 'react';

/** How often a Public page in view reloads. */
const RELOAD_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps an open Public page current. Its content, Countdown included, is
 * rendered once per request, and an iPhone resumes a page saved to its home
 * screen from memory, full screen, with no way to reload it: without this it
 * shows the day and the deploy it first loaded. So the page reloads each time
 * it comes back into view, and every few minutes while it stays there, unless
 * a video is playing.
 */
export function KeepCurrent() {
  useEffect(() => {
    function reload() {
      const playing = [...document.querySelectorAll('video')].some((video) => !video.paused && !video.ended);
      if (document.visibilityState === 'visible' && !playing) {
        window.location.reload();
      }
    }
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        reload();
      }
    }
    const timer = window.setInterval(reload, RELOAD_INTERVAL_MS);
    document.addEventListener('visibilitychange', reload);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reload);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  return null;
}
