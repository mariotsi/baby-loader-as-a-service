'use client';

import { useEffect, useState } from 'react';
import { BirthReveal } from '@/components/BirthReveal';
import { useLang } from '@/components/LangProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilePicker, type PickedFile } from '@/components/ui/FilePicker';
import { Stack } from '@/components/ui/Stack';
import { birthMediaPreviewPath } from '@/lib/birthMedia';
import type { BirthDetails, BirthMedia } from '@/lib/siteSettings';
import styles from './BirthMediaEditor.module.css';

const mediaCopy = {
  en: {
    title: 'Their first hello',
    videoDescription:
      'A welcome video for the big announcement. Pick it whenever you like: it plays once you mark the baby as born, and uploads when you save.',
    photoDescription: 'A photo for their page, beside the Birth details. It uploads when you save.',
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
    videoDescription:
      'Un video di benvenuto per il grande annuncio. Sceglilo quando vuoi: parte quando segni che il bambino è nato e viene caricato quando salvi.',
    photoDescription: 'Una foto per la pagina, accanto ai dettagli della nascita. Viene caricata quando salvi.',
    photo: 'Foto della nascita',
    photoAlt: 'Anteprima della foto della nascita',
    removePhoto: 'Rimuovi la foto',
    video: 'Video del benvenuto',
    savedVideo: 'Video salvato',
    previewVideo: 'Anteprima del benvenuto',
    removeVideo: 'Rimuovi il video',
  },
};

export type MediaDraft = BirthMedia | File | null;

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
  photo = null,
  video = null,
  onPhoto = () => {},
  onVideo = () => {},
  only,
  previewSlug,
}: {
  /** Shows one of the two: the Birth video is a setting of its own, the photo a Birth detail. */
  only?: 'photo' | 'video';
  previewSlug?: string;
  photo?: MediaDraft;
  video?: MediaDraft;
  onPhoto?: (value: MediaDraft) => void;
  onVideo?: (value: MediaDraft) => void;
}) {
  const lang = useLang();
  const t = mediaCopy[lang];
  const [preview, setPreview] = useState(false);
  const previewPhoto = previewMedia(photo, previewSlug, 'photo');
  const previewVideo = previewMedia(video, previewSlug, 'video');
  const photoUrl = useMediaUrl(previewPhoto);
  const videoUrl = useMediaUrl(previewVideo);

  return (
    <Card title={t.title} description={description(only, lang)}>
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
      {preview && videoUrl ? <BirthReveal url={videoUrl} lang={lang} onClose={() => setPreview(false)} /> : null}
    </Card>
  );
}

export function birthPhoto(details: BirthDetails | null): BirthMedia | null {
  return details?.photo ?? null;
}

export function storedDraft(draft: MediaDraft): BirthMedia | null {
  return draft instanceof File ? null : draft;
}

function description(only: 'photo' | 'video' | undefined, lang: 'en' | 'it') {
  if (only) {
    return mediaCopy[lang][only === 'photo' ? 'photoDescription' : 'videoDescription'];
  }
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

function previewMedia(media: MediaDraft, slug: string | undefined, kind: 'photo' | 'video'): MediaDraft {
  if (!slug || !media || media instanceof File) {
    return media;
  }
  return { ...media, url: birthMediaPreviewPath(slug, kind, media.key) };
}
