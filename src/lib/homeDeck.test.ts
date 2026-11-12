import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { HOME_DECK_CARDS, homeDeckCards, homeDeckImage } from './homeDeck.ts';
import { LANGS } from './i18n.ts';
import { FONTS, PALETTES } from './theme.ts';
import { isWebsiteAssetName } from './websiteAssets.ts';

const pairing = (card: { theme: { palette: string; font: string } }) => `${card.theme.palette}+${card.theme.font}`;
/** A card with its language's names and texts taken out. */
const look = ({
  theme,
  sex,
  showName,
  showSex,
  atMilestones,
  bornDaysAgo,
  dueInDays,
}: (typeof HOME_DECK_CARDS)[number]) =>
  JSON.stringify({ theme, sex, showName, showSex, atMilestones, bornDaysAgo, dueInDays });

for (const lang of LANGS) {
  const cards = homeDeckCards(lang);
  const named = cards.filter((card) => card.showName);

  test(`the ${lang} deck speaks only ${lang}`, () => {
    expect(cards.every((card) => card.lang === lang && card.languages.join() === lang)).toBeTruthy();
  });

  test(`the ${lang} deck has every pairing of a Palette and a Font`, () => {
    const every = PALETTES.flatMap((palette) => FONTS.map((font) => `${palette.id}+${font.id}`));
    expect(named.length).toBe(every.length);
    expect(new Set(named.map(pairing))).toStrictEqual(new Set(every));
  });

  test(`the ${lang} deck has as many girls as boys, and one Private card`, () => {
    expect(named.filter((card) => card.sex === 'female').length).toBe(named.length / 2);
    expect(cards.filter((card) => !card.showName && !card.showSex).length).toBe(1);
  });

  test(`the ${lang} deck never repeats a name`, () => {
    expect(new Set(cards.map((card) => card.babyName)).size).toBe(cards.length);
  });

  test(`the ${lang} deck shows girls and boys in the Born state and with Milestones`, () => {
    for (const sex of ['female', 'male']) {
      expect(named.some((card) => card.sex === sex && card.bornDaysAgo !== undefined)).toBeTruthy();
      expect(named.some((card) => card.sex === sex && card.atMilestones)).toBeTruthy();
    }
  });
}

test('both languages show the same cards, with only their names and texts changed', () => {
  expect(homeDeckCards('en').map(look)).toStrictEqual(homeDeckCards('it').map(look));
});

test('no card is past its Due date, which stays a surprise', () => {
  const waiting = HOME_DECK_CARDS.filter((card) => card.bornDaysAgo === undefined);
  expect(waiting.every((card) => card.dueInDays > 0)).toBeTruthy();
});

test('every card has its own Slug, and a picture named by its hash', () => {
  expect(new Set(HOME_DECK_CARDS.map((card) => card.slug)).size).toBe(HOME_DECK_CARDS.length);
  for (const card of HOME_DECK_CARDS) {
    const name = homeDeckImage(card);
    const hash = createHash('sha256')
      .update(readFileSync(`public/website-assets/${name}`))
      .digest('hex');
    expect(name).toBe(`${card.slug}.${hash.slice(0, 8)}.webp`);
    expect(isWebsiteAssetName(name), name).toBeTruthy();
  }
});
