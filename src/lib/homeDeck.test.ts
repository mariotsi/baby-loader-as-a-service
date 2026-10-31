import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { HOME_DECK_CARDS, homeDeckImage } from './homeDeck.ts';
import { FONTS, PALETTES } from './theme.ts';

test('the deck shows every Palette and Font', () => {
  assert.deepEqual(
    new Set(HOME_DECK_CARDS.map((card) => card.theme.palette)),
    new Set(PALETTES.map((palette) => palette.id))
  );
  assert.deepEqual(new Set(HOME_DECK_CARDS.map((card) => card.theme.font)), new Set(FONTS.map((font) => font.id)));
});

test('no card is past its Due date, which stays a surprise', () => {
  const waiting = HOME_DECK_CARDS.filter((card) => card.bornDaysAgo === undefined);
  assert.ok(waiting.every((card) => card.dueInDays > 0));
});

test('the deck has Italian and English names, for girls and boys', () => {
  const names = new Set(HOME_DECK_CARDS.filter((c) => c.showName).map((c) => `${c.languages[0]}-${c.sex}`));
  assert.deepEqual(names, new Set(['it-female', 'it-male', 'en-female', 'en-male']));
});

test('the deck shows the Born state, Milestones and the Privacy settings', () => {
  assert.ok(HOME_DECK_CARDS.some((card) => card.bornDaysAgo !== undefined));
  assert.ok(HOME_DECK_CARDS.some((card) => card.atMilestones));
  assert.ok(HOME_DECK_CARDS.some((card) => !card.showName && !card.showSex));
});

test('every card has its picture', () => {
  for (const card of HOME_DECK_CARDS) {
    assert.ok(existsSync(`public${homeDeckImage(card)}`), card.slug);
  }
});
