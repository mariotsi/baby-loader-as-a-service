import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { HOME_DECK_CARDS, homeDeckCards, homeDeckImage } from './homeDeck.ts';
import { LANGS } from './i18n.ts';
import { FONTS, PALETTES } from './theme.ts';

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
    assert.ok(cards.every((card) => card.lang === lang && card.languages.join() === lang));
  });

  test(`the ${lang} deck has every pairing of a Palette and a Font`, () => {
    const every = PALETTES.flatMap((palette) => FONTS.map((font) => `${palette.id}+${font.id}`));
    assert.equal(named.length, every.length);
    assert.deepEqual(new Set(named.map(pairing)), new Set(every));
  });

  test(`the ${lang} deck has as many girls as boys, and one Private card`, () => {
    assert.equal(named.filter((card) => card.sex === 'female').length, named.length / 2);
    assert.equal(cards.filter((card) => !card.showName && !card.showSex).length, 1);
  });

  test(`the ${lang} deck never repeats a name`, () => {
    assert.equal(new Set(cards.map((card) => card.babyName)).size, cards.length);
  });

  test(`the ${lang} deck shows girls and boys in the Born state and with Milestones`, () => {
    for (const sex of ['female', 'male']) {
      assert.ok(named.some((card) => card.sex === sex && card.bornDaysAgo !== undefined));
      assert.ok(named.some((card) => card.sex === sex && card.atMilestones));
    }
  });
}

test('both languages show the same cards, with only their names and texts changed', () => {
  assert.deepEqual(homeDeckCards('en').map(look), homeDeckCards('it').map(look));
});

test('no card is past its Due date, which stays a surprise', () => {
  const waiting = HOME_DECK_CARDS.filter((card) => card.bornDaysAgo === undefined);
  assert.ok(waiting.every((card) => card.dueInDays > 0));
});

test('every card has its own Slug and picture', () => {
  assert.equal(new Set(HOME_DECK_CARDS.map((card) => card.slug)).size, HOME_DECK_CARDS.length);
  for (const card of HOME_DECK_CARDS) {
    assert.ok(existsSync(`public${homeDeckImage(card)}`), card.slug);
  }
});
