import type { Lang } from './i18n.ts';

/**
 * The home page's deck: pictures of real Public pages, taken by `npm run deck`
 * from Sites seeded with these values. Each Platform language has its own
 * cards, with its own names and Public pages, and each deck shows every
 * Palette and Font, the Waiting and Born states, Milestones and the Privacy
 * settings. No card is past its Due date: that page stays a surprise.
 */

type PerLanguage = Record<Lang, string>;

type Scene = {
  babyName: PerLanguage;
  /** What the picture shows, for screen readers. */
  alt: PerLanguage;
  sex: 'female' | 'male';
  showName: boolean;
  showSex: boolean;
  dueInDays: number;
  bornDaysAgo?: number;
  weight?: number;
  lengthCm?: number;
  birthMessage?: PerLanguage;
  milestones?: { emoji: string; label: PerLanguage; inDays: number }[];
  pageName?: PerLanguage;
  theme: { palette: string; font: string };
  /** The picture starts at the Milestones, not at the top of the page. */
  atMilestones?: boolean;
};

export type HomeDeckCard = Omit<Scene, 'alt' | 'babyName' | 'birthMessage' | 'milestones' | 'pageName'> & {
  slug: string;
  babyName: string;
  alt: string;
  lang: Lang;
  languages: Lang[];
  birthMessage?: Partial<PerLanguage>;
  milestones?: { emoji: string; label: Partial<PerLanguage>; inDays: number }[];
  pageName?: Partial<PerLanguage>;
};

const shown = { showName: true, showSex: true };

const SCENES: Scene[] = [
  {
    ...shown,
    babyName: { en: 'Emma', it: 'Sofia' },
    alt: {
      en: 'Emma’s page, waiting with a countdown',
      it: 'La pagina di Sofia, in attesa con il conto alla rovescia',
    },
    sex: 'female',
    dueInDays: 42,
    pageName: { en: 'Anna & Tom', it: 'Anna e Tommaso' },
    theme: { palette: 'blush', font: 'quicksand' },
  },
  {
    ...shown,
    babyName: { en: 'Oliver', it: 'Leonardo' },
    alt: { en: 'Oliver’s page, just born, with his picture', it: 'La pagina di Leonardo appena nato, con la sua foto' },
    sex: 'male',
    dueInDays: -2,
    bornDaysAgo: 3,
    weight: 3480,
    lengthCm: 52,
    birthMessage: { en: 'Mum and baby are doing great!', it: 'Mamma e bimbo stanno benissimo!' },
    pageName: { en: 'Grace & Jack', it: 'Chiara e Marco' },
    theme: { palette: 'sky', font: 'playfair' },
  },
  {
    ...shown,
    babyName: { en: 'Charlotte', it: 'Giulia' },
    alt: {
      en: 'Charlotte’s page, with the milestones of the wait',
      it: 'La pagina di Giulia, con le tappe dell’attesa',
    },
    sex: 'female',
    dueInDays: 75,
    milestones: [
      { emoji: '🧪', label: { en: 'The test is positive!', it: 'Il test è positivo!' }, inDays: -170 },
      { emoji: '🩺', label: { en: 'First scan', it: 'Prima ecografia' }, inDays: -100 },
      { emoji: '💗', label: { en: 'We heard the heartbeat', it: 'Abbiamo sentito il cuore' }, inDays: -60 },
      { emoji: '🥰', label: { en: 'First kicks', it: 'Primi calcetti' }, inDays: -20 },
      { emoji: '🎈', label: { en: 'Baby shower', it: 'Baby shower' }, inDays: 30 },
      { emoji: '🧳', label: { en: 'Hospital bag packed', it: 'Valigia pronta' }, inDays: 60 },
    ],
    atMilestones: true,
    theme: { palette: 'sage', font: 'merriweather' },
  },
  {
    ...shown,
    babyName: { en: 'Noah', it: 'Tommaso' },
    alt: {
      en: 'Noah’s page, just born, with his picture, in dark colors',
      it: 'La pagina di Tommaso appena nato, con la sua foto, in colori scuri',
    },
    sex: 'male',
    dueInDays: 1,
    bornDaysAgo: 10,
    weight: 3620,
    lengthCm: 51,
    birthMessage: { en: 'Everyone is doing well, and nobody is sleeping.', it: 'Stiamo tutti bene, ma nessuno dorme.' },
    pageName: { en: 'Lily & Sam', it: 'Marta e Luca' },
    theme: { palette: 'midnight', font: 'poppins' },
  },
  {
    babyName: { en: 'Alice', it: 'Bianca' },
    alt: {
      en: 'A page that keeps the baby’s name and sex a secret',
      it: 'Una pagina che tiene segreti il nome e il sesso',
    },
    sex: 'female',
    showName: false,
    showSex: false,
    dueInDays: 28,
    pageName: { en: 'Ella & Ben', it: 'Elena e Paolo' },
    theme: { palette: 'lavender', font: 'inter' },
  },
  {
    ...shown,
    babyName: { en: 'Olivia', it: 'Ginevra' },
    alt: { en: 'Olivia’s page, with the milestones of the wait', it: 'La pagina di Ginevra, con le tappe dell’attesa' },
    sex: 'female',
    dueInDays: 60,
    milestones: [
      { emoji: '🧪', label: { en: 'The test is positive!', it: 'Il test è positivo!' }, inDays: -180 },
      { emoji: '🩺', label: { en: 'First scan', it: 'Prima ecografia' }, inDays: -110 },
      { emoji: '🥰', label: { en: 'First kicks', it: 'Primi calcetti' }, inDays: -50 },
      { emoji: '🛏️', label: { en: 'Nursery painted', it: 'Cameretta pronta' }, inDays: -14 },
      { emoji: '🎈', label: { en: 'Baby shower', it: 'Baby shower' }, inDays: 21 },
      { emoji: '🧳', label: { en: 'Hospital bag packed', it: 'Valigia pronta' }, inDays: 45 },
    ],
    atMilestones: true,
    theme: { palette: 'sunshine', font: 'playfair' },
  },
  {
    ...shown,
    babyName: { en: 'James', it: 'Matteo' },
    alt: {
      en: 'James’s page, waiting with a countdown, in dark colors',
      it: 'La pagina di Matteo, in attesa con il conto alla rovescia, in colori scuri',
    },
    sex: 'male',
    dueInDays: 16,
    theme: { palette: 'midnight', font: 'quicksand' },
  },
  {
    ...shown,
    babyName: { en: 'Amelia', it: 'Aurora' },
    alt: { en: 'Amelia’s page, just born, with her picture', it: 'La pagina di Aurora appena nata, con la sua foto' },
    sex: 'female',
    dueInDays: 2,
    bornDaysAgo: 6,
    weight: 3150,
    lengthCm: 49,
    birthMessage: { en: 'Welcome, little Amelia!', it: 'Benvenuta, piccola Aurora!' },
    theme: { palette: 'blush', font: 'poppins' },
  },
  {
    ...shown,
    babyName: { en: 'Henry', it: 'Lorenzo' },
    alt: {
      en: 'Henry’s page, waiting with a countdown',
      it: 'La pagina di Lorenzo, in attesa con il conto alla rovescia',
    },
    sex: 'male',
    dueInDays: 94,
    pageName: { en: 'Kate & Will', it: 'Sara e Davide' },
    theme: { palette: 'sage', font: 'inter' },
  },
];

function sceneCard(scene: Scene, lang: Lang): HomeDeckCard {
  const { alt, babyName, birthMessage, milestones, pageName, ...rest } = scene;
  return {
    ...rest,
    slug: `deck-${babyName[lang].toLowerCase()}`,
    babyName: babyName[lang],
    alt: alt[lang],
    lang,
    languages: [lang],
    ...(birthMessage ? { birthMessage: { [lang]: birthMessage[lang] } } : {}),
    ...(milestones ? { milestones: milestones.map((m) => ({ ...m, label: { [lang]: m.label[lang] } })) } : {}),
    ...(pageName ? { pageName: { [lang]: pageName[lang] } } : {}),
  };
}

/** The cards of one Platform language's deck, in the order they come up. */
export function homeDeckCards(lang: Lang): HomeDeckCard[] {
  return SCENES.map((scene) => sceneCard(scene, lang));
}

/** Every card of every language, for seeding the Sites and taking the pictures. */
export const HOME_DECK_CARDS: HomeDeckCard[] = [...homeDeckCards('en'), ...homeDeckCards('it')];

/** Where the home page finds a card's picture. */
export function homeDeckImage(card: Pick<HomeDeckCard, 'slug'>): string {
  return `/home-deck/${card.slug}.webp`;
}
