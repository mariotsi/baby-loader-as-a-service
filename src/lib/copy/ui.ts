import type { Lang } from '../i18n.ts';

/**
 * The words the design system's own components carry, in every language in
 * `Lang`. A component reads them with `uiCopy[useLang()]`; text a page passes
 * in, like a label, comes from the page's dictionary.
 */
const en = {
  optional: 'Optional',
  filePicker: {
    choose: 'Choose a file',
    drop: 'Drop your file here',
    orDrop: 'or drag and drop it here',
    single: 'Choose one file at a time.',
    type: 'Choose one of the supported file types.',
    size: 'Choose a non-empty file up to',
  },
  palette: 'Palette',
  font: 'Font',
  languages: {
    legend: 'Languages',
    hint: "Tick every language your page speaks. You write your page's words in each of them: your Page name, Milestones, Birth message and Notifications get a box per language. Visitors get the one their browser asks for, or English if your page has it, and can switch.",
    keepOne: 'Your page needs at least one language.',
  },
  emoji: {
    search: 'Search emoji',
    searchPlaceholder: 'Search',
    loading: 'Loading emoji…',
    empty: 'No emoji found.',
  },
};

export type UiCopy = typeof en;

const it: UiCopy = {
  optional: 'Opzionale',
  filePicker: {
    choose: 'Scegli un file',
    drop: 'Rilascia qui il file',
    orDrop: 'oppure trascinalo qui',
    single: 'Scegli un solo file alla volta.',
    type: 'Scegli uno dei formati supportati.',
    size: 'Scegli un file non vuoto fino a',
  },
  palette: 'Palette',
  font: 'Carattere',
  languages: {
    legend: 'Lingue',
    hint: 'Spunta ogni lingua che parla la tua pagina. Scrivi le parole della pagina in ognuna: nome della pagina, tappe, messaggio di nascita e notifiche hanno un campo per lingua. I visitatori vedono quella che chiede il loro browser, o l’inglese se la tua pagina lo parla, e possono cambiarla.',
    keepOne: 'La tua pagina ha bisogno di almeno una lingua.',
  },
  emoji: {
    search: 'Cerca un’emoji',
    searchPlaceholder: 'Cerca',
    loading: 'Caricamento delle emoji…',
    empty: 'Nessuna emoji trovata.',
  },
};

export const uiCopy: Record<Lang, UiCopy> = { it, en };
