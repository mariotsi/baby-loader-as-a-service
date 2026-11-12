import { expect, test } from 'vitest';
import {
  FALLBACK_LANGS,
  fallbackLang,
  inPlatformOrder,
  isLang,
  LANGS,
  languageName,
  negotiateLang,
  plural,
} from './i18n.ts';

test('the language cookie wins when the Site speaks it', () => {
  expect(negotiateLang('en-US,en;q=0.9', 'it', ['en', 'it'])).toBe('it');
  expect(negotiateLang('it-IT', 'en', ['it']), 'a cookie for a Language the Site lacks is ignored').toBe('it');
});

test('the best-ranked Accept-Language the Site speaks wins', () => {
  expect(negotiateLang('fr-FR,fr;q=0.9,en;q=0.8,it;q=0.7', null, ['it', 'en'])).toBe('en');
  expect(negotiateLang('en;q=0.5,it;q=0.9', null, ['en', 'it'])).toBe('it');
  expect(negotiateLang('en-GB,it;q=0.4', null, ['it'])).toBe('it');
});

// The cases below follow baby-loader's i18n tests: the same negotiation, among a Site's Languages.
const BOTH = ['it', 'en'] as const;

test('the region and the letter case of a language tag do not matter', () => {
  expect(negotiateLang('en-GB', null, [...BOTH])).toBe('en');
  expect(negotiateLang('it-CH,it', null, ['en', 'it'])).toBe('it');
  expect(negotiateLang('EN-us', null, [...BOTH])).toBe('en');
});

test('q weights rank the entries even when the browser lists them out of order', () => {
  expect(negotiateLang('de;q=1.0,it;q=0.3,en;q=0.8', null, [...BOTH])).toBe('en');
  expect(negotiateLang('de;q=1.0,it;q=0.8,en;q=0.3', null, [...BOTH])).toBe('it');
});

test('entries with the same weight keep the order the browser declared them in', () => {
  expect(negotiateLang('en,it', null, [...BOTH])).toBe('en');
  expect(negotiateLang('it,en', null, ['en', 'it'])).toBe('it');
});

test('an unknown or empty cookie is ignored', () => {
  expect(negotiateLang('en-US,en;q=0.9', 'de', [...BOTH])).toBe('en');
  expect(negotiateLang('en-US,en;q=0.9', '', [...BOTH])).toBe('en');
});

test('entries with weight zero are not acceptable', () => {
  expect(negotiateLang('en;q=0,it;q=0.5', null, [...BOTH])).toBe('it');
});

test('with no match English wins if the Site speaks it, Italian otherwise', () => {
  expect(negotiateLang('', null, [...BOTH])).toBe('en');
  expect(negotiateLang(null, null, [...BOTH])).toBe('en');
  expect(negotiateLang('*', null, [...BOTH])).toBe('en');
  expect(negotiateLang('garbage;;;', null, [...BOTH])).toBe('en');
  expect(negotiateLang('fr-FR,de;q=0.8', null, [...BOTH])).toBe('en');
  expect(negotiateLang('fr-FR', null, ['it'])).toBe('it');
});

test('every supported language has a place in the fallback order', () => {
  expect(new Set(FALLBACK_LANGS)).toStrictEqual(new Set(LANGS));
  expect(fallbackLang(['it', 'en'])).toBe('en');
  expect(fallbackLang(['it'])).toBe('it');
});

test('inPlatformOrder lists Languages as the Platform does, whatever order they come in', () => {
  expect(inPlatformOrder(['en', 'it'])).toStrictEqual(['it', 'en']);
  expect(inPlatformOrder(['en'])).toStrictEqual(['en']);
});

test('isLang and languageName cover the supported languages', () => {
  expect(isLang('it')).toBe(true);
  expect(isLang('fr')).toBe(false);
  expect(languageName('it', 'en')).toBe('Italian');
  expect(languageName('en', 'en')).toBe('English');
  expect(languageName('en', 'it')).toBe('inglese');
  expect(languageName('it', 'it')).toBe('italiano');
  expect(languageName('fr', 'en')).toBe('French');
});

test('a count takes its plural form by the language’s rules', () => {
  const days = { one: 'day', other: 'days' };
  expect(plural('en', 1, days)).toBe('day');
  expect(plural('en', 0, days)).toBe('days');
  expect(plural('en', 2, days)).toBe('days');
  expect(plural('it', 1, { one: 'giorno', other: 'giorni' })).toBe('giorno');
  expect(plural('it', 5, { one: 'giorno', other: 'giorni' })).toBe('giorni');
});

test('a plural form a dictionary leaves out falls back to other', () => {
  expect(plural('en', 1, { other: 'days' })).toBe('days');
});

test('the Platform offers every language, falling back to English', () => {
  expect(negotiateLang('fr-FR', null, LANGS)).toBe('en');
  expect(negotiateLang('it-IT,en;q=0.5', null, LANGS)).toBe('it');
});
