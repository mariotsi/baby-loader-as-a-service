import type { Lang } from '../i18n.ts';

/** The Birth photo and Birth video pickers, in the Site settings and the Birth dialog. */
const en = {
  title: 'Their first hello',
  photoTitle: 'Their first photo',
  videoDescription:
    'A welcome video for the big announcement. Once the baby is born, it plays full screen the first time each visitor opens the page, and they can watch it again from there. Pick it whenever you like: it uploads when you save.',
  /** Over both pickers, when the editor shows the photo and the video together. */
  bothDescription: 'A photo for their page and a video for the big announcement. Files upload when you save.',
  photoDescription: 'A photo for their page, beside the Birth details. It uploads when you save.',
  photo: 'Birth photo',
  photoAlt: 'Birth photo preview',
  removePhoto: 'Remove photo',
  video: 'Welcome video',
  savedVideo: 'Saved video',
  previewVideo: 'Preview the welcome',
  removeVideo: 'Remove video',
};

export type BirthMediaCopy = typeof en;

const it: BirthMediaCopy = {
  title: 'Il primo ciao',
  photoTitle: 'La sua prima foto',
  videoDescription:
    'Un video di benvenuto per il grande annuncio. Quando il bambino è nato, parte a schermo intero la prima volta che ogni visitatore apre la pagina, e da lì si può rivedere. Sceglilo quando vuoi: viene caricato quando salvi.',
  bothDescription: 'Una foto per la pagina e un video per il grande annuncio. I file vengono caricati quando salvi.',
  photoDescription: 'Una foto per la pagina, accanto ai dettagli della nascita. Viene caricata quando salvi.',
  photo: 'Foto della nascita',
  photoAlt: 'Anteprima della foto della nascita',
  removePhoto: 'Rimuovi la foto',
  video: 'Video del benvenuto',
  savedVideo: 'Video salvato',
  previewVideo: 'Anteprima del benvenuto',
  removeVideo: 'Rimuovi il video',
};

export const birthMediaCopy: Record<Lang, BirthMediaCopy> = { it, en };
