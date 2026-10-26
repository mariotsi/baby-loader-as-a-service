'use client';

import { useEffect } from 'react';

/** The attribute `<html>` carries once React has hydrated the page. */
export const HYDRATED_ATTRIBUTE = 'data-hydrated';

/**
 * Marks `<html>` once the page is interactive. Rendered last in the root
 * layout, outside any Suspense boundary, so its effect runs once the whole
 * page has hydrated. Before that a form's controlled inputs show what is
 * typed but keep their state, so a save sends the old values: the E2E suite
 * waits for this mark after every navigation before it touches a page.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, '');
  }, []);
  return null;
}
