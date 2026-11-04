import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settingsInState } from './previewSettings.ts';
import { defaultSiteSettings, type SiteSettings } from './siteSettings.ts';

const NOW = new Date('2026-10-20T10:00:00Z');

function site(overrides: Partial<SiteSettings> = {}): SiteSettings {
  return { ...structuredClone(defaultSiteSettings), babyName: 'Emma', ...overrides } as SiteSettings;
}

const BORN: SiteSettings['birth'] = {
  born: true,
  details: { datetime: '2026-10-19T08:30:00.000Z', weightGrams: 3400, lengthCm: 50, message: {} },
};

test('a Site already in the state stays as it is', () => {
  const waiting = site();
  const born = site({ birth: BORN });
  assert.equal(settingsInState(waiting, 'waiting', NOW), waiting);
  assert.equal(settingsInState(born, 'born', NOW), born);
});

test('a Waiting Site previews Born with today, no numbers, and the Birth milestone', () => {
  const previewed = settingsInState(site({ sex: 'female', privacy: { showName: false, showSex: false } }), 'born', NOW);
  assert.deepEqual(previewed.birth, {
    born: true,
    details: { datetime: NOW.toISOString(), weightGrams: null, lengthCm: null, message: {} },
  });
  assert.deepEqual(previewed.milestones, [
    { emoji: '👶', label: { en: 'She is born!' }, date: '2026-10-20', kind: 'birth' },
  ]);
  // The Born state shows the name and the Sex whatever the Privacy settings say, and announcing leaves them be.
  assert.deepEqual(previewed.privacy, { showName: false, showSex: false });
});

test('a Born Site previews Waiting without its Birth details or Birth milestone', () => {
  const previewed = settingsInState(
    site({
      birth: BORN,
      milestones: [
        { emoji: '👶', date: '2026-10-19', label: { en: 'She is born!' }, kind: 'birth' },
        { emoji: '🏠', date: '2026-10-22', label: { en: 'Coming home' } },
      ],
    }),
    'waiting',
    NOW
  );
  assert.deepEqual(previewed.birth, { born: false, details: null });
  assert.deepEqual(
    previewed.milestones.map((milestone) => milestone.label.en),
    ['Coming home']
  );
});
