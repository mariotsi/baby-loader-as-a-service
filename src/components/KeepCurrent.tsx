'use client';

import { useEffect } from 'react';

/** How often a Public page saved to the home screen reloads while in view. */
const RELOAD_INTERVAL_MS = 5 * 60_000;

/**
 * Keeps a Public page saved to the home screen current. Its content,
 * Countdown included, is rendered once per request, and an iPhone resumes
 * such a page from memory, full screen, with no way to reload it: without
 * this it shows the day and the deploy it first loaded. So there the page
 * reloads each time it comes back into view, and every few minutes while it
 * stays there, unless a video is playing. In a browser tab, which can be
 * reloaded, it does nothing, so open tabs add no load on the server.
 */
export function KeepCurrent() {
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) {
      return;
    }
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
