import { expect, test } from 'vitest';
import { type NotificationSite, notificationContent, notificationIcon } from './notificationContent.ts';
import { defaultSiteSettings, isoDateTimeSchema } from './siteSettings.ts';

const asInstant = (value: string) => isoDateTimeSchema.parse(value);

const site: NotificationSite = { ...defaultSiteSettings, babyName: 'Sofia', languages: ['it', 'en'] };
const hidden: NotificationSite = { ...site, privacy: { showName: false, showSex: true } };
const bornBirth = {
  born: true,
  details: { datetime: asInstant('2026-01-15T08:30:00.000Z'), weightGrams: null, lengthCm: null, message: {} },
} as const;

test('a written title wins', () => {
  expect(notificationContent(hidden, { it: { title: 'Novità', body: 'Ciao' } }, 'it', '/i').title).toBe('Novità');
});

test('without a title, the baby’s name where Privacy settings show it', () => {
  expect(notificationContent(site, { it: { body: 'Ciao' } }, 'it', '/i').title).toBe('Sofia');
  const born = { ...hidden, birth: bornBirth };
  expect(notificationContent(born, { it: { body: 'Ciao' } }, 'it', '/i').title).toBe('Sofia');
});

test('without a title and with the name hidden, the Site’s name in the text’s Language', () => {
  const named = { ...hidden, pageName: { it: 'Casa Rossi', en: 'The Rossis' } };
  expect(notificationContent(named, { it: { body: 'Ciao' } }, 'it', '/i').title).toBe('Casa Rossi');
  expect(notificationContent(named, { en: { body: 'Hi' } }, 'en', '/i').title).toBe('The Rossis');
  expect(notificationContent(hidden, { it: { body: 'Ciao' } }, 'it', '/i').title).toBe('Loading Baby');
});

test('the text and the buttons follow the Subscription’s Language, else the Site’s fallback one', () => {
  const messages = { it: { body: 'Ciao' }, en: { body: 'Hi' } };
  expect(notificationContent(site, messages, 'it', '/i')).toStrictEqual({
    lang: 'it',
    title: 'Sofia',
    body: 'Ciao',
    icon: '/i',
    actions: { open: 'Apri', dismiss: 'Chiudi' },
  });
  const old = notificationContent(site, messages, null, '/i');
  expect(old.lang).toBe('en');
  expect(old.actions).toStrictEqual({ open: 'Open', dismiss: 'Dismiss' });
  const onlyItalian = notificationContent(site, { it: { body: 'Ciao' } }, 'en', '/i');
  expect(onlyItalian.lang).toBe('it');
  expect(onlyItalian.body).toBe('Ciao');
});

test('the icon is the birth photo once born, else the Site icon', () => {
  expect(notificationIcon(site, 'https://sofia.test/', 'https://media.test/photo')).toBe('/icon-192.png');
  const born = { ...site, birth: bornBirth };
  expect(notificationIcon(born, 'https://sofia.test/', 'https://media.test/photo')).toBe('https://media.test/photo');
  expect(notificationIcon(born, 'https://sofia.test/', null)).toBe('/icon-192.png');
});
