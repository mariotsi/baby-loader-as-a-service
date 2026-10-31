import type { Lang } from './i18n.ts';
import { FONTS, PALETTES } from './theme.ts';

/**
 * The home page's deck: pictures of real Public pages, taken by `npm run deck`
 * from Sites seeded with these values. There is one card for each pairing of a
 * Palette and a Font, half of them girls and half boys, plus one that keeps the
 * Privacy settings on. The cards come in the same order in every Platform
 * language, and only their names and texts change. The states take turns
 * between Waiting, Born and Milestones, and no card is past its Due date: that
 * page stays a surprise.
 */

type PerLanguage = Record<Lang, string>;
type Sex = 'female' | 'male';
type State = 'waiting' | 'born' | 'milestones';

export type HomeDeckCard = {
  slug: string;
  lang: Lang;
  languages: Lang[];
  babyName: string;
  /** What the picture shows, for screen readers. */
  alt: string;
  sex: Sex;
  showName: boolean;
  showSex: boolean;
  dueInDays: number;
  bornDaysAgo?: number;
  weight?: number;
  lengthCm?: number;
  birthMessage?: Partial<PerLanguage>;
  milestones?: { emoji: string; label: Partial<PerLanguage>; inDays: number }[];
  pageName?: Partial<PerLanguage>;
  theme: { palette: string; font: string };
  /** The picture starts at the Milestones, not at the top of the page. */
  atMilestones?: boolean;
};

const PAIRINGS = PALETTES.length * FONTS.length;
/** Where the Private card sits in the deck. */
const PRIVATE_AT = 4;
/** Quicksand comes first, so the deck opens on the Platform's own look. */
const FIRST_FONT = FONTS.findIndex((font) => font.id === 'quicksand');

const NAMES: Record<Sex, Record<Lang, string[]>> = {
  female: {
    en: 'Emma Charlotte Olivia Amelia Ava Isla Grace Lily Ruby Freya Evie Hazel Ivy Chloe Poppy'.split(' '),
    it: 'Sofia Giulia Ginevra Aurora Beatrice Alice Vittoria Martina Chiara Greta Ludovica Matilde Emma Anna Viola'.split(
      ' '
    ),
  },
  male: {
    en: 'Oliver Noah James Henry Jack Theo Oscar Arthur Leo George Harry Lucas Finn Archie Thomas'.split(' '),
    it: 'Leonardo Tommaso Matteo Lorenzo Francesco Edoardo Alessandro Andrea Gabriele Riccardo Niccolò Pietro Davide Giovanni Filippo'.split(
      ' '
    ),
  },
};

const PAGE_NAMES: PerLanguage[] = [
  { en: 'Anna & Tom', it: 'Anna e Tommaso' },
  { en: 'Grace & Jack', it: 'Chiara e Marco' },
  { en: 'Lily & Sam', it: 'Marta e Luca' },
  { en: 'Kate & Will', it: 'Sara e Davide' },
  { en: 'Ella & Ben', it: 'Elena e Paolo' },
];

const MILESTONES: { emoji: string; label: PerLanguage; inDays: number }[] = [
  { emoji: '🧪', label: { en: 'The test is positive!', it: 'Il test è positivo!' }, inDays: -170 },
  { emoji: '🩺', label: { en: 'First scan', it: 'Prima ecografia' }, inDays: -100 },
  { emoji: '💗', label: { en: 'We heard the heartbeat', it: 'Abbiamo sentito il cuore' }, inDays: -60 },
  { emoji: '🥰', label: { en: 'First kicks', it: 'Primi calcetti' }, inDays: -20 },
  { emoji: '🎈', label: { en: 'Baby shower', it: 'Baby shower' }, inDays: 14 },
  { emoji: '🧳', label: { en: 'Hospital bag packed', it: 'Valigia pronta' }, inDays: 21 },
];

const ALT: Record<State, (name: string, sex: Sex) => PerLanguage> = {
  waiting: (name) => ({
    en: `${name}’s page, waiting with a countdown`,
    it: `La pagina di ${name}, in attesa con il conto alla rovescia`,
  }),
  born: (name, sex) => ({
    en: `${name}’s page, just born, with ${sex === 'female' ? 'her' : 'his'} picture`,
    it: `La pagina di ${name} ${sex === 'female' ? 'appena nata' : 'appena nato'}, con la foto`,
  }),
  milestones: (name) => ({
    en: `${name}’s page, with the milestones of the wait`,
    it: `La pagina di ${name}, con le tappe dell’attesa`,
  }),
};

function welcome(name: string, sex: Sex): PerLanguage {
  return {
    en: `Welcome, little ${name}!`,
    it: sex === 'female' ? `Benvenuta, piccola ${name}!` : `Benvenuto, piccolo ${name}!`,
  };
}

/** Each six cards hold three girls and three boys, starting from the other sex, so a Palette gets both. */
function sexAt(i: number): Sex {
  return (i + Math.floor(i / PALETTES.length)) % 2 === 0 ? 'female' : 'male';
}

/** A girl and a boy in a row share a state, so each state gets both. */
function stateAt(i: number): State {
  return (['waiting', 'born', 'milestones', 'waiting'] as const)[Math.floor(i / 2) % 4];
}

/** Six and five share no divisor, so stepping both lists at once reaches every pairing exactly once. */
function pairingCard(i: number, lang: Lang): HomeDeckCard {
  const sex = sexAt(i);
  const state = stateAt(i);
  const babyName = NAMES[sex][lang][Math.floor(i / 2)];
  const pageName = i % 3 === 2 ? null : PAGE_NAMES[i % PAGE_NAMES.length];
  const born = state === 'born';
  return {
    slug: `deck-${lang}-${i}`,
    lang,
    languages: [lang],
    babyName,
    alt: ALT[state](babyName, sex)[lang],
    sex,
    showName: true,
    showSex: true,
    dueInDays: born ? -2 : 42 + ((i * 7) % 60),
    ...(born
      ? {
          bornDaysAgo: 3 + (i % 8),
          weight: 3100 + ((i * 41) % 600),
          lengthCm: 48 + (i % 5),
          birthMessage: { [lang]: welcome(babyName, sex)[lang] },
        }
      : {}),
    ...(state === 'milestones'
      ? {
          milestones: MILESTONES.map((m) => ({ ...m, label: { [lang]: m.label[lang] } })),
          atMilestones: true,
        }
      : {}),
    ...(pageName ? { pageName: { [lang]: pageName[lang] } } : {}),
    theme: {
      palette: PALETTES[i % PALETTES.length].id,
      font: FONTS[(i + FIRST_FONT) % FONTS.length].id,
    },
  };
}

function privateCard(lang: Lang): HomeDeckCard {
  return {
    slug: `deck-${lang}-private`,
    lang,
    languages: [lang],
    babyName: lang === 'en' ? 'Alice' : 'Bianca',
    alt:
      lang === 'en'
        ? 'A page that keeps the baby’s name and sex a secret'
        : 'Una pagina che tiene segreti il nome e il sesso',
    sex: 'female',
    showName: false,
    showSex: false,
    dueInDays: 28,
    pageName: { [lang]: PAGE_NAMES[4][lang] },
    theme: { palette: 'lavender', font: 'inter' },
  };
}

function buildDeck(lang: Lang): HomeDeckCard[] {
  const cards = Array.from({ length: PAIRINGS }, (_, i) => pairingCard(i, lang));
  cards.splice(PRIVATE_AT, 0, privateCard(lang));
  return cards;
}

const DECKS: Record<Lang, HomeDeckCard[]> = { en: buildDeck('en'), it: buildDeck('it') };

/** The cards of one Platform language's deck, in the order they come up. */
export function homeDeckCards(lang: Lang): HomeDeckCard[] {
  return DECKS[lang];
}

/** Every card of every language, for seeding the Sites and taking the pictures. */
export const HOME_DECK_CARDS: HomeDeckCard[] = [...DECKS.en, ...DECKS.it];

/** Where the home page finds a card's picture. */
export function homeDeckImage(card: Pick<HomeDeckCard, 'slug'>): string {
  return `/home-deck/${card.slug}.webp`;
}
