import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  assert.equal(notificationContent(hidden, { it: { title: 'Novità', body: 'Ciao' } }, 'it', '/i').title, 'Novità');
});

test('without a title, the baby’s name where Privacy settings show it', () => {
  assert.equal(notificationContent(site, { it: { body: 'Ciao' } }, 'it', '/i').title, 'Sofia');
  const born = { ...hidden, birth: bornBirth };
  assert.equal(notificationContent(born, { it: { body: 'Ciao' } }, 'it', '/i').title, 'Sofia');
});

test('without a title and with the name hidden, the Site’s name in the text’s Language', () => {
  const named = { ...hidden, pageName: { it: 'Casa Rossi', en: 'The Rossis' } };
  assert.equal(notificationContent(named, { it: { body: 'Ciao' } }, 'it', '/i').title, 'Casa Rossi');
  assert.equal(notificationContent(named, { en: { body: 'Hi' } }, 'en', '/i').title, 'The Rossis');
  assert.equal(notificationContent(hidden, { it: { body: 'Ciao' } }, 'it', '/i').title, 'Loading Baby');
});

test('the text and the buttons follow the Subscription’s Language, else the Site’s fallback one', () => {
  const messages = { it: { body: 'Ciao' }, en: { body: 'Hi' } };
  assert.deepEqual(notificationContent(site, messages, 'it', '/i'), {
    lang: 'it',
    title: 'Sofia',
    body: 'Ciao',
    icon: '/i',
    actions: { open: 'Apri', dismiss: 'Chiudi' },
  });
  const old = notificationContent(site, messages, null, '/i');
  assert.equal(old.lang, 'en');
  assert.deepEqual(old.actions, { open: 'Open', dismiss: 'Dismiss' });
  const onlyItalian = notificationContent(site, { it: { body: 'Ciao' } }, 'en', '/i');
  assert.equal(onlyItalian.lang, 'it');
  assert.equal(onlyItalian.body, 'Ciao');
});

test('the icon is the birth photo once born, else the Site icon', () => {
  assert.equal(notificationIcon(site, 'https://sofia.test/', 'https://media.test/photo'), '/icon-192.png');
  const born = { ...site, birth: bornBirth };
  assert.equal(notificationIcon(born, 'https://sofia.test/', 'https://media.test/photo'), 'https://media.test/photo');
  assert.equal(notificationIcon(born, 'https://sofia.test/', null), '/icon-192.png');
});
