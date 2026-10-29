import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siteShortName, twemojiUrl } from './siteAppIdentity.ts';
import { secondsUntilMidnight, shareImageDay, shareImageLang, shareText, siteIconUrl } from './siteMeta.ts';
import { defaultSiteSettings, type SiteSettings } from './siteSettings.ts';

const NOW = new Date('2026-10-20T10:00:00Z');
const ADDRESS = 'https://emma.loading.baby';

function site(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return {
    ...structuredClone(defaultSiteSettings),
    babyName: 'Emma',
    sex: 'female',
    dueDate: '2026-11-01',
    ...overrides,
  } as SiteSettings;
}

test('the loading baby uses the Platform’s own icon files', () => {
  assert.equal(siteIconUrl(site(), 'apple', ADDRESS), '/apple-icon.png');
  assert.equal(siteIconUrl(site(), 'maskable', ADDRESS), '/icon-maskable-512.png');
});

test('an emoji icon is generated at the Site’s Address, its URL changing with the emoji and the Palette', () => {
  assert.equal(siteIconUrl(site({ icon: '🐣' }), 'apple', ADDRESS), `${ADDRESS}/site-icon/apple?v=1f423.blush`);
  assert.equal(
    siteIconUrl(site({ icon: '❤️', theme: { palette: 'sky', font: 'inter' } }), '192', ADDRESS),
    `${ADDRESS}/site-icon/192?v=2764-fe0f.sky`
  );
});

test('the home screen names the Site after its Page name, else the baby where the page shows the name', () => {
  const named = site({ languages: ['it', 'en'], pageName: { it: 'Stefania e Simone', en: 'Stefania & Simone' } });
  assert.equal(siteShortName(named, 'it'), 'Stefania e Simone');
  assert.equal(siteShortName(named, 'en'), 'Stefania & Simone');
  assert.equal(siteShortName(site({ pageName: { it: 'Stefania e Simone' } }), 'en'), 'Emma');
  const hidden = site({ privacy: { showName: false, showSex: true } });
  assert.equal(siteShortName(hidden, 'en'), 'Loading Baby');
  const born = { born: true as const, details: { datetime: '', weightGrams: null, lengthCm: null, message: {} } };
  assert.equal(siteShortName({ ...hidden, birth: born }, 'en'), 'Emma');
});

test('a link preview carries the headline and the Countdown in the language asked for', () => {
  const both = site({ languages: ['it', 'en'] });
  assert.deepEqual(shareText(both, 'en', NOW), {
    title: 'We are waiting for Emma',
    description: '12 days to go · Due date: November 1, 2026',
  });
  assert.deepEqual(shareText({ ...both, privacy: { showName: false, showSex: false } }, 'it', NOW), {
    title: 'Stiamo aspettando qualcuno',
    description: '12 giorni rimanenti · Arrivo previsto: 1 novembre 2026',
  });
});

test('a share image speaks the Language its URL names, if the Site speaks it, else the fallback Language', () => {
  assert.equal(shareImageLang('it', ['it', 'en']), 'it');
  assert.equal(shareImageLang('it', ['en']), 'en');
  assert.equal(shareImageLang('fr', ['it', 'en']), 'en');
  assert.equal(shareImageLang(null, ['it']), 'it');
});

test('the share image changes at midnight in the Site’s Timezone', () => {
  const lateEvening = new Date('2026-10-20T21:30:00Z');
  assert.equal(shareImageDay('Europe/Rome', lateEvening), '2026-10-20');
  assert.equal(secondsUntilMidnight('Europe/Rome', lateEvening), 30 * 60);
  assert.equal(shareImageDay('Asia/Tokyo', lateEvening), '2026-10-21');
});

test('the previews draw the same Twemoji image as the generated icons', () => {
  const base = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';
  assert.equal(twemojiUrl('🐣'), `${base}1f423.svg`);
  assert.equal(twemojiUrl('❤️'), `${base}2764.svg`);
  assert.equal(twemojiUrl('👨‍👩‍👧'), `${base}1f468-200d-1f469-200d-1f467.svg`);
});
