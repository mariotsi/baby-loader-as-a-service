import { expect, test } from 'vitest';
import { siteShortName, twemojiUrl } from './siteAppIdentity.ts';
import { secondsUntilMidnight, shareImageDay, shareImageLang, shareText, siteIconUrl } from './siteMeta.ts';
import { defaultSiteSettings, emojiSchema, isoDateTimeSchema, type SiteSettings } from './siteSettings.ts';

const asInstant = (value: string) => isoDateTimeSchema.parse(value);

const asEmoji = (value: string) => emojiSchema.parse(value);

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
  expect(siteIconUrl(site(), 'apple', ADDRESS)).toBe('/apple-icon.png');
  expect(siteIconUrl(site(), 'maskable', ADDRESS)).toBe('/icon-maskable-512.png');
});

test('an emoji icon is generated at the Site’s Address, its URL changing with the emoji and the Palette', () => {
  expect(siteIconUrl(site({ icon: asEmoji('🐣') }), 'apple', ADDRESS)).toBe(`${ADDRESS}/site-icon/apple?v=1f423.blush`);
  expect(siteIconUrl(site({ icon: asEmoji('❤️'), theme: { palette: 'sky', font: 'inter' } }), '192', ADDRESS)).toBe(
    `${ADDRESS}/site-icon/192?v=2764-fe0f.sky`
  );
});

test('the home screen names the Site after its Page name, else the baby where the page shows the name', () => {
  const named = site({ languages: ['it', 'en'], pageName: { it: 'Stefania e Simone', en: 'Stefania & Simone' } });
  expect(siteShortName(named, 'it')).toBe('Stefania e Simone');
  expect(siteShortName(named, 'en')).toBe('Stefania & Simone');
  expect(siteShortName(site({ pageName: { it: 'Stefania e Simone' } }), 'en')).toBe('Emma');
  const hidden = site({ privacy: { showName: false, showSex: true } });
  expect(siteShortName(hidden, 'en')).toBe('Loading Baby');
  const datetime = asInstant('2026-10-19T08:30:00.000Z');
  const born = { born: true as const, details: { datetime, weightGrams: null, lengthCm: null, message: {} } };
  expect(siteShortName({ ...hidden, birth: born }, 'en')).toBe('Emma');
});

test('a link preview carries the headline and the Countdown in the language asked for', () => {
  const both = site({ languages: ['it', 'en'] });
  expect(shareText(both, 'en', NOW)).toStrictEqual({
    title: 'We are waiting for Emma',
    description: '12 days to go · Due date: November 1, 2026',
  });
  expect(shareText({ ...both, privacy: { showName: false, showSex: false } }, 'it', NOW)).toStrictEqual({
    title: 'Stiamo aspettando qualcuno',
    description: '12 giorni rimanenti · Arrivo previsto: 1 novembre 2026',
  });
});

test('a share image speaks the Language its URL names, if the Site speaks it, else the fallback Language', () => {
  expect(shareImageLang('it', ['it', 'en'])).toBe('it');
  expect(shareImageLang('it', ['en'])).toBe('en');
  expect(shareImageLang('fr', ['it', 'en'])).toBe('en');
  expect(shareImageLang(null, ['it'])).toBe('it');
});

test('the share image changes at midnight in the Site’s Timezone', () => {
  const lateEvening = new Date('2026-10-20T21:30:00Z');
  expect(shareImageDay('Europe/Rome', lateEvening)).toBe('2026-10-20');
  expect(secondsUntilMidnight('Europe/Rome', lateEvening)).toBe(30 * 60);
  expect(shareImageDay('Asia/Tokyo', lateEvening)).toBe('2026-10-21');
});

test('the previews draw the same Twemoji image as the generated icons', () => {
  const base = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';
  expect(twemojiUrl('🐣')).toBe(`${base}1f423.svg`);
  expect(twemojiUrl('❤️')).toBe(`${base}2764.svg`);
  expect(twemojiUrl('👨‍👩‍👧')).toBe(`${base}1f468-200d-1f469-200d-1f467.svg`);
});
