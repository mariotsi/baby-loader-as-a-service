import { expect, test } from 'vitest';
import {
  draftOfSite,
  draftProblems,
  lastValidSettings,
  newSiteDraft,
  readStoredDraft,
  type SiteDraft,
  settingsOfDraft,
  unpickedPlaces,
} from './siteDraft.ts';
import {
  calendarDaySchema,
  centimetresSchema,
  DEFAULT_SITE_ICON_EMOJI,
  defaultSiteSettings,
  emojiSchema,
  gramsSchema,
  isoDateTimeSchema,
  type Milestone,
  parseSiteSettings,
  type SiteSettings,
  timeZoneSchema,
} from './siteSettings.ts';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);
const asInstant = (value: string) => isoDateTimeSchema.parse(value);
const NOW = new Date('2026-10-27T00:00:00Z');

const scan: Milestone = { emoji: asEmoji('🩺'), label: { en: 'First scan', it: '' }, date: asDay('2026-08-01') };
const birthMilestone: Milestone = {
  emoji: asEmoji('👶'),
  label: { en: 'She is born!' },
  date: asDay('2026-10-26'),
  kind: 'birth',
};

/** A Site Born on 2026-10-25 at 20:00 UTC, which is the 26th in Auckland. */
const emma: SiteSettings = {
  ...structuredClone(defaultSiteSettings),
  babyName: 'Emma',
  sex: 'female',
  dueDate: asDay('2026-11-01'),
  languages: ['en'],
  timezone: timeZoneSchema.parse('Pacific/Auckland'),
  pageName: { en: 'The Rossis', it: '' },
  icon: asEmoji('🎀'),
  birth: {
    born: true,
    details: {
      datetime: asInstant('2026-10-25T20:00:00.000Z'),
      weightGrams: gramsSchema.parse(3400),
      lengthCm: centimetresSchema.parse(50),
      message: { en: 'Welcome!' },
      photo: null,
    },
  },
  milestones: [scan, birthMilestone],
};

function birthOf(site: SiteSettings) {
  return { birth: site.birth, birthVideo: site.birthVideo };
}

test('a saved Site comes back out of its draft as it was saved, but for blank texts', () => {
  const settings = settingsOfDraft(draftOfSite(emma), birthOf(emma));
  expect(settings).toStrictEqual({
    ...emma,
    pageName: { en: 'The Rossis' },
    milestones: [{ ...scan, label: { en: 'First scan' } }, birthMilestone],
  });
  expect(parseSiteSettings(settings, NOW).ok).toBe(true);
});

test('a draft holds the fields as a form shows them', () => {
  const draft = draftOfSite({ ...emma, dueDate: null, icon: null });
  expect(draft.dueDate).toBe('');
  expect(draft.iconIsEmoji).toBe(false);
  expect(draft.iconEmoji).toBe(DEFAULT_SITE_ICON_EMOJI);
  expect(draft.milestones.map((m) => m.placeText)).toStrictEqual(['', '']);
  const placed = draftOfSite({ ...emma, milestones: [{ ...scan, place: { address: 'Via Roma 1', lat: 1, lon: 2 } }] });
  expect(placed.milestones[0].placeText).toBe('Via Roma 1');
});

test('a new Site starts Waiting, in the Owner’s Language and their browser’s Timezone', () => {
  const draft = newSiteDraft('it', 'Europe/Rome');
  const settings = settingsOfDraft({ ...draft, dueDate: '2026-12-01' });
  expect(settings.languages).toStrictEqual(['it']);
  expect(settings.timezone).toBe('Europe/Rome');
  expect(settings.birth).toStrictEqual({ born: false, details: null });
  expect(settings.birthVideo).toBe(null);
  expect(settings.icon).toBe(null);
  expect(parseSiteSettings(settings, new Date('2026-10-20T12:00:00Z')).ok).toBe(true);
});

test('the Site icon keeps its emoji while the loading baby is picked, and sends it only when picked', () => {
  const draft = draftOfSite(emma);
  expect(settingsOfDraft({ ...draft, iconIsEmoji: false }).icon).toBe(null);
  expect(draftOfSite({ ...emma, icon: null }).iconEmoji).toBe(DEFAULT_SITE_ICON_EMOJI);
  const back = { ...draft, iconIsEmoji: false };
  expect(settingsOfDraft({ ...back, iconIsEmoji: true }).icon).toBe('🎀');
});

test('blank texts are dropped, and a text in a Language the Site no longer speaks is kept', () => {
  const draft: SiteDraft = { ...draftOfSite(emma), languages: ['en'], pageName: { en: '  ', it: 'I Rossi' } };
  expect(settingsOfDraft(draft).pageName).toStrictEqual({ it: 'I Rossi' });
});

test('the Birth milestone stands on the day of birth in the Site’s Timezone, and goes while Waiting', () => {
  const draft: SiteDraft = {
    ...draftOfSite(emma),
    milestones: draftOfSite(emma).milestones.map((m) => (m.kind === 'birth' ? { ...m, date: '2026-01-01' } : m)),
  };
  expect(settingsOfDraft(draft, birthOf(emma)).milestones[1].date).toBe('2026-10-26');
  expect(settingsOfDraft({ ...draft, timezone: 'America/Los_Angeles' }, birthOf(emma)).milestones[1].date).toBe(
    '2026-10-25'
  );
  expect(settingsOfDraft(draft).milestones.map((m) => m.kind)).toStrictEqual([undefined]);
});

test('previews keep the last valid settings while a field is half filled', () => {
  const first = lastValidSettings(settingsOfDraft(draftOfSite(emma), birthOf(emma)), defaultSiteSettings, NOW);
  expect(first.babyName).toBe('Emma');
  const halfFilled = settingsOfDraft({ ...draftOfSite(emma), babyName: 'Sofia', dueDate: '2026-02-3' }, birthOf(emma));
  expect(lastValidSettings(halfFilled, first, NOW)).toBe(first);
});

test('a Place typed and never picked stops a save', () => {
  const draft = draftOfSite({ ...emma, birth: { born: false, details: null }, milestones: [scan] });
  const typed = { ...draft, milestones: [{ ...draft.milestones[0], placeText: 'Via Ro' }] };
  expect(unpickedPlaces(typed.milestones)).toStrictEqual([{ path: 'milestones.0.place', code: 'invalidOption' }]);
  expect(draftProblems(typed, undefined, NOW).map((e) => e.path)).toStrictEqual(['milestones.0.place']);
  expect(draftProblems({ ...typed, dueDate: 'soon' }, undefined, NOW).map((e) => e.path)).toStrictEqual([
    'dueDate',
    'milestones.0.place',
  ]);
});

test('a stored draft is read back only in the shape this module writes', () => {
  const draft = newSiteDraft('en', 'Europe/Rome');
  expect(readStoredDraft(JSON.parse(JSON.stringify(draft)))).toStrictEqual(draft);
  const older = { slug: 'emma', babyName: '', sex: 'unknown', dueDate: '', languages: ['en'] };
  expect(readStoredDraft(older)).toBe(null);
  expect(readStoredDraft(null)).toBe(null);
});
