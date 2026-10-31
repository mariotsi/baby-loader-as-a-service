'use client';

import { useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { platformCopy } from '@/lib/copy/platform';
import { fallbackLang } from '@/lib/i18n';
import { type PreviewState, settingsInState } from '@/lib/previewSettings';
import type { SiteSettings } from '@/lib/siteSettings';
import { type MediaDraft, useBirthMediaUrl } from './BirthMediaEditor';
import { PublicPagePreview } from './PublicPagePreview';
import styles from './SiteEditor.module.css';

interface EditorPreviewProps {
  /** The Site settings as they stand, or as they last stood valid. */
  settings: SiteSettings;
  slug: string;
  photo?: MediaDraft;
  video?: MediaDraft;
  mediaPreviewSlug?: string;
  bornPlaceholderUrl: string;
  /** Below 48rem the preview shows only while the PhoneStrip has it open; from 48rem it always shows. */
  open: boolean;
  id: string;
}

/** The Public page beside the form, with the toggle between its Waiting and Born states. */
export function EditorPreview({
  settings,
  slug,
  photo = null,
  video = null,
  mediaPreviewSlug,
  bornPlaceholderUrl,
  open,
  id,
}: EditorPreviewProps) {
  const pageLang = useLang();
  const t = platformCopy[pageLang].settings;
  /** Null until the Owner picks a state: the preview then follows the Site's. */
  const [picked, setPicked] = useState<PreviewState | null>(null);
  const state = picked ?? (settings.birth.born ? 'born' : 'waiting');
  const photoUrl = useBirthMediaUrl(photo, mediaPreviewSlug, 'photo');
  const videoUrl = useBirthMediaUrl(video, mediaPreviewSlug, 'video');
  return (
    <aside
      id={id}
      className={open ? `${styles.preview} ${styles.previewOpen}` : styles.preview}
      aria-label={t.previewPage}
    >
      <SegmentedControl
        legend={t.previewState}
        hideLegend
        size="sm"
        options={[
          { value: 'waiting', label: t.previewWaiting },
          { value: 'born', label: t.previewBorn },
        ]}
        value={state}
        onChange={setPicked}
      />
      <PublicPagePreview
        settings={settingsInState(settings, state)}
        slug={slug}
        lang={settings.languages.includes(pageLang) ? pageLang : fallbackLang(settings.languages)}
        caption={t.previewPage}
        bornImageUrl={photoUrl ?? bornPlaceholderUrl}
        birthVideoUrl={videoUrl}
        compact
      />
    </aside>
  );
}
