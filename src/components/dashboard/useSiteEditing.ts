'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { SiteDTO } from '@/lib/site';
import { createSiteEditing, type SiteEditing, type SiteEditingPort } from '@/lib/siteEditing';
import { fetchSiteEditingPort } from '@/lib/siteEditingPort';

/**
 * The Site editing of the editor that calls it: one store for as long as the
 * editor is mounted, opened on `site` as the server rendered it. Each save
 * that goes through refreshes the route, so the pages around the editor show
 * the Site as saved. `port` is the Platform's routes unless a test or a story
 * passes its own.
 */
export function useSiteEditing(site: SiteDTO, port?: SiteEditingPort): SiteEditing {
  const [editing] = useState(() => createSiteEditing(site, port ?? fetchSiteEditingPort(site.slug)));
  const router = useRouter();
  const savedAt = useStore(editing, (state) => state.stored.updatedAt);
  const shown = useRef(savedAt);
  useEffect(() => {
    if (savedAt !== shown.current) {
      shown.current = savedAt;
      router.refresh();
    }
  }, [savedAt, router]);
  return editing;
}
