'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Whether a sticky element has stuck. Put the returned ref on an empty element
 * right before it: once that marker scrolls past the element's `top`, it stuck.
 */
export function useStuck() {
  const marker = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    function measure() {
      const sticky = marker.current?.nextElementSibling;
      if (marker.current && sticky) {
        setStuck(marker.current.getBoundingClientRect().top < Number.parseFloat(getComputedStyle(sticky).top));
      }
    }
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);

  return { marker, stuck };
}
