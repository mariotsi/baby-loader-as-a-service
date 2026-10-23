import assert from 'node:assert/strict';
import { test } from 'node:test';
import { englishName, isLang, negotiateLang } from './i18n.ts';

test('the language cookie wins when the Site speaks it', () => {
  assert.equal(negotiateLang('en-US,en;q=0.9', 'it', ['en', 'it']), 'it');
  assert.equal(negotiateLang('it-IT', 'en', ['it']), 'it', 'a cookie for a Language the Site lacks is ignored');
});

test('the best-ranked Accept-Language the Site speaks wins', () => {
  assert.equal(negotiateLang('fr-FR,fr;q=0.9,en;q=0.8,it;q=0.7', null, ['it', 'en']), 'en');
  assert.equal(negotiateLang('en;q=0.5,it;q=0.9', null, ['en', 'it']), 'it');
  assert.equal(negotiateLang('en-GB,it;q=0.4', null, ['it']), 'it');
});

// The cases below follow baby-loader's i18n tests: the same negotiation, among a Site's Languages.
const BOTH = ['it', 'en'] as const;

test('the region and the letter case of a language tag do not matter', () => {
  assert.equal(negotiateLang('en-GB', null, [...BOTH]), 'en');
  assert.equal(negotiateLang('it-CH,it', null, ['en', 'it']), 'it');
  assert.equal(negotiateLang('EN-us', null, [...BOTH]), 'en');
});

test('q weights rank the entries even when the browser lists them out of order', () => {
  assert.equal(negotiateLang('de;q=1.0,it;q=0.3,en;q=0.8', null, [...BOTH]), 'en');
  assert.equal(negotiateLang('de;q=1.0,it;q=0.8,en;q=0.3', null, [...BOTH]), 'it');
});

test('entries with the same weight keep the order the browser declared them in', () => {
  assert.equal(negotiateLang('en,it', null, [...BOTH]), 'en');
  assert.equal(negotiateLang('it,en', null, ['en', 'it']), 'it');
});

test('an unknown or empty cookie is ignored', () => {
  assert.equal(negotiateLang('en-US,en;q=0.9', 'de', [...BOTH]), 'en');
  assert.equal(negotiateLang('en-US,en;q=0.9', '', [...BOTH]), 'en');
});

test("with no match the Site's main Language wins", () => {
  assert.equal(negotiateLang('', null, [...BOTH]), 'it');
  assert.equal(negotiateLang('*', null, ['en', 'it']), 'en');
  assert.equal(negotiateLang('garbage;;;', null, [...BOTH]), 'it');
  assert.equal(negotiateLang('fr-FR,de;q=0.8', null, ['it', 'en']), 'it');
  assert.equal(negotiateLang('fr-FR', null, ['en', 'it']), 'en');
  assert.equal(negotiateLang(null, null, ['it', 'en']), 'it');
  assert.equal(negotiateLang('en;q=0', null, ['it', 'en']), 'it', 'q=0 means not acceptable');
});

test('isLang and englishName cover the supported languages', () => {
  assert.equal(isLang('it'), true);
  assert.equal(isLang('fr'), false);
  assert.equal(englishName('it'), 'Italian');
  assert.equal(englishName('en'), 'English');
});
