import { expect, test } from 'vitest';
import { settingsInState } from './previewSettings.ts';
import {
  calendarDaySchema,
  centimetresSchema,
  defaultSiteSettings,
  emojiSchema,
  gramsSchema,
  isoDateTimeSchema,
  type SiteSettings,
} from './siteSettings.ts';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);
const asInstant = (value: string) => isoDateTimeSchema.parse(value);

const NOW = new Date('2026-10-20T10:00:00Z');

function site(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return { ...structuredClone(defaultSiteSettings), babyName: 'Emma', ...overrides } as SiteSettings;
}

const BORN: SiteSettings['birth'] = {
  born: true,
  details: {
    datetime: asInstant('2026-10-19T08:30:00.000Z'),
    weightGrams: gramsSchema.parse(3400),
    lengthCm: centimetresSchema.parse(50),
    message: {},
  },
};

test('a Site already in the state stays as it is', () => {
  const waiting = site();
  const born = site({ birth: BORN });
  expect(settingsInState(waiting, 'waiting', NOW)).toBe(waiting);
  expect(settingsInState(born, 'born', NOW)).toBe(born);
});

test('a Waiting Site previews Born with today, no numbers, and the Birth milestone', () => {
  const previewed = settingsInState(site({ sex: 'female', privacy: { showName: false, showSex: false } }), 'born', NOW);
  expect(previewed.birth).toStrictEqual({
    born: true,
    details: { datetime: NOW.toISOString(), weightGrams: null, lengthCm: null, message: {} },
  });
  expect(previewed.milestones).toStrictEqual([
    { emoji: '👶', label: { en: 'She is born!' }, date: '2026-10-20', kind: 'birth' },
  ]);
  // The Born state shows the name and the Sex whatever the Privacy settings say, and announcing leaves them be.
  expect(previewed.privacy).toStrictEqual({ showName: false, showSex: false });
});

test('a Born Site previews Waiting without its Birth details or Birth milestone', () => {
  const previewed = settingsInState(
    site({
      birth: BORN,
      milestones: [
        { emoji: asEmoji('👶'), date: asDay('2026-10-19'), label: { en: 'She is born!' }, kind: 'birth' },
        { emoji: asEmoji('🏠'), date: asDay('2026-10-22'), label: { en: 'Coming home' } },
      ],
    }),
    'waiting',
    NOW
  );
  expect(previewed.birth).toStrictEqual({ born: false, details: null });
  expect(previewed.milestones.map((milestone) => milestone.label.en)).toStrictEqual(['Coming home']);
});
