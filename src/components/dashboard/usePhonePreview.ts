'use client';

import { useEffect, useId, useState } from 'react';

const WIDE = '(min-width: 48rem)';

/**
 * The preview opened from the PhoneStrip, which fills a phone's screen: while
 * open, the Platform's header goes inert with the `content` the page marks
 * inert, Escape closes it, and so does growing to a width with the preview
 * beside the form.
 */
export function usePhonePreview() {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const wide = window.matchMedia(WIDE);
    const close = () => setOpen(false);
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
    // The first header in the page is PageShell's: the Public page's inside the preview comes later.
    const header = document.querySelector('header');
    header?.setAttribute('inert', '');
    wide.addEventListener('change', close);
    document.addEventListener('keydown', onKey);
    return () => {
      header?.removeAttribute('inert');
      wide.removeEventListener('change', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return { open, id, toggle: () => setOpen(!open) };
}
