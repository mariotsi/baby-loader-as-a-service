'use client';

import { useEffect, useState } from 'react';
import { BirthReveal } from '@/components/BirthReveal';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilePicker, type PickedFile } from '@/components/ui/FilePicker';
import { Stack } from '@/components/ui/Stack';
import { birthMediaPreviewPath, type MediaUrl, mediaUrlSchema } from '@/lib/birthMedia';
import { birthMediaCopy } from '@/lib/copy/birthMedia';
import { publicPageCopy } from '@/lib/copy/publicPage';
import type { Lang } from '@/lib/i18n';
import type { BirthDetails, BirthMedia } from '@/lib/siteSettings';
import styles from './BirthMediaEditor.module.css';

export type MediaDraft = BirthMedia | File | null;

/** The Birth video's section, which the Site settings' menu names. */
export function birthVideoTitle(lang: Lang) {
  return birthMediaCopy[lang].title;
}

export function useMediaUrl(media: MediaDraft): MediaUrl | undefined {
  const [local, setLocal] = useState<MediaUrl>();
  useEffect(() => {
    if (!(media instanceof File)) {
      setLocal(undefined);
      return;
    }
    const url = URL.createObjectURL(media);
    setLocal(mediaUrlSchema.parse(url));
    return () => URL.revokeObjectURL(url);
  }, [media]);
  if (media instanceof File) {
    return local;
  }
  return media ? mediaUrlSchema.parse(media.url) : undefined;
}

/** Where the page shows `media`: a picked file from the browser, a saved one from storage, or from the page's own origin on Previews (see mediaFromPageOrigin). */
export function useBirthMediaUrl(media: MediaDraft, previewSlug: string | undefined, kind: 'photo' | 'video') {
  return useMediaUrl(previewMedia(media, previewSlug, kind));
}

export function BirthMediaEditor({
  photo = null,
  video = null,
  onPhoto = () => {},
  onVideo = () => {},
  only,
  previewSlug,
  headingLevel,
}: {
  /** 3 inside a dialog or section that has its own heading. */
  headingLevel?: 2 | 3;
  /** Shows one of the two: the Birth video is a setting of its own, the photo a Birth detail. */
  only?: 'photo' | 'video';
  previewSlug?: string;
  photo?: MediaDraft;
  video?: MediaDraft;
  onPhoto?: (value: MediaDraft) => void;
  onVideo?: (value: MediaDraft) => void;
}) {
  const lang = useLang();
  const t = birthMediaCopy[lang];
  const [preview, setPreview] = useState(false);
  const previewPhoto = previewMedia(photo, previewSlug, 'photo');
  const previewVideo = previewMedia(video, previewSlug, 'video');
  const photoUrl = useMediaUrl(previewPhoto);
  const videoUrl = useMediaUrl(previewVideo);

  return (
    <Card
      title={only === 'photo' ? t.photoTitle : t.title}
      description={description(only, lang)}
      headingLevel={headingLevel}
    >
      {only !== 'video' ? (
        <>
          <FilePicker
            label={t.photo}
            hint="AVIF, JPEG, PNG, WebP · 5 MB"
            optional
            accept={['image/avif', 'image/jpeg', 'image/png', 'image/webp']}
            maxBytes={5 * 1024 * 1024}
            value={pickerValue(previewPhoto, t.photo, 'image')}
            onChange={onPhoto}
          />
          {photoUrl ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: Local files use browser object URLs. */}
              <img className={styles.photo} src={photoUrl} alt={t.photoAlt} />
              <div>
                <Button variant="ghost" onClick={() => onPhoto(null)}>
                  {t.removePhoto}
                </Button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {only !== 'photo' ? (
        <>
          <FilePicker
            label={t.video}
            hint="MP4, WebM · 50 MB"
            optional
            accept={['video/mp4', 'video/webm']}
            maxBytes={50 * 1024 * 1024}
            value={pickerValue(previewVideo, t.savedVideo, 'video')}
            onChange={onVideo}
          />
          {videoUrl ? (
            <Stack direction="row" gap={3}>
              <Button onClick={() => setPreview(true)}>{t.previewVideo}</Button>
              <Button variant="ghost" onClick={() => onVideo(null)}>
                {t.removeVideo}
              </Button>
            </Stack>
          ) : null}
        </>
      ) : null}
      {preview && videoUrl ? (
        <BirthReveal url={videoUrl} t={publicPageCopy[lang].reveal} onClose={() => setPreview(false)} />
      ) : null}
    </Card>
  );
}

export function birthPhoto(details: BirthDetails | null): BirthMedia | null {
  return details?.photo ?? null;
}

export function storedDraft(draft: MediaDraft): BirthMedia | null {
  return draft instanceof File ? null : draft;
}

function description(only: 'photo' | 'video' | undefined, lang: Lang) {
  if (only) {
    return birthMediaCopy[lang][only === 'photo' ? 'photoDescription' : 'videoDescription'];
  }
  return birthMediaCopy[lang].bothDescription;
}

function pickerValue(media: MediaDraft, name: string, type: string): PickedFile | null {
  if (!media || media instanceof File) {
    return media;
  }
  return { url: media.url, name: media.name ?? name, type: media.type ?? type, size: media.size };
}

function previewMedia(media: MediaDraft, slug: string | undefined, kind: 'photo' | 'video'): MediaDraft {
  if (!slug || !media || media instanceof File) {
    return media;
  }
  return { ...media, url: birthMediaPreviewPath(slug, kind, media.key) };
}
