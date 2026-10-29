'use client';

import { useEffect, useState } from 'react';
import { BirthReveal } from '@/components/BirthReveal';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilePicker, type PickedFile } from '@/components/ui/FilePicker';
import { Stack } from '@/components/ui/Stack';
import type { BirthDetails } from '@/lib/siteSettings';
import styles from './BirthMediaEditor.module.css';

const mediaCopy = {
  en: {
    title: 'Their first hello',
    videoDescription: 'A welcome video for the big announcement. It uploads when you save.',
    photo: 'Birth photo',
    photoAlt: 'Birth photo preview',
    removePhoto: 'Remove photo',
    video: 'Welcome video',
    savedVideo: 'Saved video',
    previewVideo: 'Preview the welcome',
    removeVideo: 'Remove video',
  },
  it: {
    title: 'Il primo ciao',
    videoDescription: 'Un video di benvenuto per il grande annuncio. Viene caricato quando salvi.',
    photo: 'Foto della nascita',
    photoAlt: 'Anteprima della foto della nascita',
    removePhoto: 'Rimuovi la foto',
    video: 'Video del benvenuto',
    savedVideo: 'Video salvato',
    previewVideo: 'Anteprima del benvenuto',
    removeVideo: 'Rimuovi il video',
  },
};

export type MediaDraft = NonNullable<BirthDetails['photo']> | File | null;

export function useMediaUrl(media: MediaDraft): string | undefined {
  const [local, setLocal] = useState<string>();
  useEffect(() => {
    if (!(media instanceof File)) {
      setLocal(undefined);
      return;
    }
    const url = URL.createObjectURL(media);
    setLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [media]);
  return media instanceof File ? local : media?.url;
}

export function BirthMediaEditor({
  photo,
  video,
  onPhoto,
  onVideo,
  videoOnly = false,
}: {
  videoOnly?: boolean;
  photo: MediaDraft;
  video: MediaDraft;
  onPhoto: (value: MediaDraft) => void;
  onVideo: (value: MediaDraft) => void;
}) {
  const lang = useLang();
  const t = mediaCopy[lang];
  const [preview, setPreview] = useState(false);
  const photoUrl = useMediaUrl(photo);
  const videoUrl = useMediaUrl(video);

  return (
    <Card title={t.title} description={videoOnly ? t.videoDescription : photoDescription(lang)}>
      {!videoOnly ? (
        <>
          <FilePicker
            label={t.photo}
            hint="AVIF, JPEG, PNG, WebP · 5 MB"
            optional
            accept={['image/avif', 'image/jpeg', 'image/png', 'image/webp']}
            maxBytes={5 * 1024 * 1024}
            value={pickerValue(photo, t.photo, 'image')}
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
      <FilePicker
        label={t.video}
        hint="MP4, WebM · 50 MB"
        optional
        accept={['video/mp4', 'video/webm']}
        maxBytes={50 * 1024 * 1024}
        value={pickerValue(video, t.savedVideo, 'video')}
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
      {preview && videoUrl ? <BirthReveal url={videoUrl} lang={lang} onClose={() => setPreview(false)} /> : null}
    </Card>
  );
}

export function initialMedia(details: BirthDetails | null, kind: 'photo' | 'video'): ReturnType<typeof storedDraft> {
  return details?.[kind] ?? null;
}

export function storedDraft(draft: MediaDraft): NonNullable<BirthDetails['photo']> | null {
  return draft instanceof File ? null : draft;
}

function photoDescription(lang: 'en' | 'it') {
  return lang === 'it'
    ? 'Una foto per la pagina e un video per il grande annuncio. I file vengono caricati quando salvi.'
    : 'A photo for their page and a video for the big announcement. Files upload when you save.';
}

function pickerValue(media: MediaDraft, name: string, type: string): PickedFile | null {
  if (!media || media instanceof File) {
    return media;
  }
  return { url: media.url, name: media.name ?? name, type: media.type ?? type, size: media.size };
}
