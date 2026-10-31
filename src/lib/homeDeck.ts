/**
 * The cards of the home page's deck: each one a picture of a real Public page,
 * taken by `npm run deck` from a Site seeded with these values. The deck shows
 * every Palette and Font, the Waiting and Born states, Milestones and the
 * Privacy settings, in Italian and English, and leaves out the days past the
 * Due date: that page stays a surprise.
 */

export type HomeDeckCard = {
  slug: string;
  babyName: string;
  sex: 'female' | 'male';
  languages: ('it' | 'en')[];
  showName: boolean;
  showSex: boolean;
  dueInDays: number;
  bornDaysAgo?: number;
  weight?: number;
  lengthCm?: number;
  birthMessage?: { it?: string; en?: string };
  milestones?: {
    emoji: string;
    label: { it?: string; en?: string };
    inDays: number;
    place?: { address: string; lat: number; lon: number };
  }[];
  pageName?: { it?: string; en?: string };
  theme: { palette: string; font: string };
  /** The picture starts at the Milestones, not at the top of the page. */
  atMilestones?: boolean;
};

const shown = { showName: true, showSex: true };
const it = ['it'] as HomeDeckCard['languages'];
const en = ['en'] as HomeDeckCard['languages'];

export const HOME_DECK_CARDS: HomeDeckCard[] = [
  {
    ...shown,
    slug: 'deck-emma',
    babyName: 'Emma',
    sex: 'female',
    languages: en,
    dueInDays: 42,
    pageName: { en: 'Anna & Tom' },
    theme: { palette: 'blush', font: 'quicksand' },
  },
  {
    ...shown,
    slug: 'deck-leonardo',
    babyName: 'Leonardo',
    sex: 'male',
    languages: it,
    dueInDays: -2,
    bornDaysAgo: 3,
    weight: 3480,
    lengthCm: 52,
    birthMessage: { it: 'Mamma e bimbo stanno benissimo!' },
    pageName: { it: 'Chiara e Marco' },
    theme: { palette: 'sky', font: 'playfair' },
  },
  {
    ...shown,
    slug: 'deck-giulia',
    babyName: 'Giulia',
    sex: 'female',
    languages: it,
    dueInDays: 75,
    milestones: [
      { emoji: '🧪', label: { it: 'Il test è positivo!' }, inDays: -170 },
      { emoji: '🩺', label: { it: 'Prima ecografia' }, inDays: -100 },
      { emoji: '💗', label: { it: 'Abbiamo sentito il cuore' }, inDays: -60 },
      { emoji: '🥰', label: { it: 'Primi calcetti' }, inDays: -20 },
      { emoji: '🎈', label: { it: 'Baby shower' }, inDays: 30 },
      { emoji: '🧳', label: { it: 'Valigia pronta' }, inDays: 60 },
    ],
    atMilestones: true,
    theme: { palette: 'sage', font: 'merriweather' },
  },
  {
    ...shown,
    slug: 'deck-oliver',
    babyName: 'Oliver',
    sex: 'male',
    languages: en,
    dueInDays: 1,
    bornDaysAgo: 10,
    weight: 3620,
    lengthCm: 51,
    birthMessage: { en: 'Everyone is doing well, and nobody is sleeping.' },
    pageName: { en: 'Grace & Jack' },
    theme: { palette: 'midnight', font: 'poppins' },
  },
  {
    slug: 'deck-secret',
    babyName: 'Bianca',
    sex: 'female',
    languages: it,
    showName: false,
    showSex: false,
    dueInDays: 28,
    pageName: { it: 'Elena e Paolo' },
    theme: { palette: 'lavender', font: 'inter' },
  },
  {
    ...shown,
    slug: 'deck-charlotte',
    babyName: 'Charlotte',
    sex: 'female',
    languages: en,
    dueInDays: 60,
    milestones: [
      { emoji: '🧪', label: { en: 'The test is positive!' }, inDays: -180 },
      { emoji: '🩺', label: { en: 'First scan' }, inDays: -110 },
      { emoji: '🥰', label: { en: 'First kicks' }, inDays: -50 },
      { emoji: '🛏️', label: { en: 'Nursery painted' }, inDays: -14 },
      { emoji: '🎈', label: { en: 'Baby shower' }, inDays: 21 },
      { emoji: '🧳', label: { en: 'Hospital bag packed' }, inDays: 45 },
    ],
    atMilestones: true,
    theme: { palette: 'sunshine', font: 'playfair' },
  },
  {
    ...shown,
    slug: 'deck-matteo',
    babyName: 'Matteo',
    sex: 'male',
    languages: it,
    dueInDays: 16,
    theme: { palette: 'midnight', font: 'quicksand' },
  },
  {
    ...shown,
    slug: 'deck-aurora',
    babyName: 'Aurora',
    sex: 'female',
    languages: it,
    dueInDays: 2,
    bornDaysAgo: 6,
    weight: 3150,
    lengthCm: 49,
    birthMessage: { it: 'Benvenuta, piccola Aurora!' },
    theme: { palette: 'blush', font: 'poppins' },
  },
  {
    ...shown,
    slug: 'deck-henry',
    babyName: 'Henry',
    sex: 'male',
    languages: en,
    dueInDays: 94,
    pageName: { en: 'Lily & Sam' },
    theme: { palette: 'sage', font: 'inter' },
  },
];

/** Where the home page finds a card's picture. */
export function homeDeckImage(card: Pick<HomeDeckCard, 'slug'>): string {
  return `/home-deck/${card.slug}.webp`;
}
