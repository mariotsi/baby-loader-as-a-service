import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { HOME_DECK_CARDS, homeDeckCards, homeDeckImage } from './homeDeck.ts';
import { LANGS } from './i18n.ts';
import { FONTS, PALETTES } from './theme.ts';

for (const lang of LANGS) {
  const cards = homeDeckCards(lang);

  test(`the ${lang} deck speaks only ${lang}`, () => {
    assert.ok(cards.every((card) => card.lang === lang && card.languages.join() === lang));
  });

  test(`the ${lang} deck shows every Palette and Font`, () => {
    assert.deepEqual(new Set(cards.map((card) => card.theme.palette)), new Set(PALETTES.map((p) => p.id)));
    assert.deepEqual(new Set(cards.map((card) => card.theme.font)), new Set(FONTS.map((f) => f.id)));
  });

  test(`the ${lang} deck has names for girls and boys`, () => {
    assert.deepEqual(new Set(cards.filter((c) => c.showName).map((c) => c.sex)), new Set(['female', 'male']));
  });

  test(`the ${lang} deck shows the Born state, Milestones and the Privacy settings`, () => {
    assert.ok(cards.some((card) => card.bornDaysAgo !== undefined));
    assert.ok(cards.some((card) => card.atMilestones));
    assert.ok(cards.some((card) => !card.showName && !card.showSex));
  });
}

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
