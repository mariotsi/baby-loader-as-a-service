'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * While `dirty`, the browser asks before closing or reloading the tab, and a
 * click on a link inside the app waits for an answer: `target` is where it was
 * going, for the page to ask with a ConfirmDialog, then `leave` or `stay`.
 * Links to the page itself, like a SectionNav's, go through.
 */
export function useLeaveGuard(dirty: boolean) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    function hold(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === '_blank'
      ) {
        return;
      }
      const url = new URL(link.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) {
        return;
      }
      // In the capture phase, so it runs before next/link's own click handler.
      event.preventDefault();
      event.stopPropagation();
      setTarget(`${url.pathname}${url.search}${url.hash}`);
    }
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', hold, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', hold, true);
    };
  }, [dirty]);

  return {
    target,
    stay: () => setTarget(null),
    leave: () => {
      if (target) {
        setTarget(null);
        router.push(target);
      }
    },
  };
}
