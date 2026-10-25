import type { Lang } from '../i18n.ts';

/**
 * The copy of the Platform's own pages, in every language in `Lang`. English
 * sets the shape; every other language must match it, so a missing entry is a
 * type error.
 */
const en = {
  marketing: {
    eyebrow: 'For the days before the big day',
    title: 'A page for the wait, made yours',
    lead: 'Create a countdown and birth announcement page for your baby. Pick your colors and your letters, choose what to show, and share it on your own link.',
    createPage: 'Create your page',
    logIn: 'Log in',
  },
};

export type PlatformCopy = typeof en;

const it: PlatformCopy = {
  marketing: {
    eyebrow: 'Per i giorni prima del grande giorno',
    title: 'Una pagina per l’attesa, tutta tua',
    lead: 'Crea una pagina con il conto alla rovescia e l’annuncio della nascita del tuo bambino. Scegli i colori e i caratteri, decidi cosa mostrare e condividila con il tuo link.',
    createPage: 'Crea la tua pagina',
    logIn: 'Accedi',
  },
};

export const platformCopy: Record<Lang, PlatformCopy> = { it, en };
