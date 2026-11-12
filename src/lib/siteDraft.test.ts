import { expect, test } from 'vitest';
import {
  type BirthDraft,
  birthDraftOf,
  birthSettings,
  birthWrite,
  draftOfSite,
  draftProblems,
  lastValidSettings,
  newSiteDraft,
  readStoredDraft,
  type SiteDraft,
  sameDraft,
  settingsOfDraft,
  unpickedPlaces,
  withSavedBirthMilestone,
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
  return { birth: birthSettings(birthDraftOf(site), site.timezone), birthVideo: site.birthVideo };
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

test('the Birth’s time is typed on the wall clock in the Site’s Timezone', () => {
  const draft = birthDraftOf(emma);
  expect(draft.datetime).toBe('2026-10-26T09:00');
  expect([draft.weight, draft.lengthCm]).toStrictEqual(['3400', '50']);
  const settings = birthSettings({ ...draft, weight: '', message: { en: 'Hi', it: ' ' } }, 'Europe/Rome');
  expect(settings).toStrictEqual({
    born: true,
    details: {
      datetime: '2026-10-26T08:00:00.000Z',
      weightGrams: null,
      lengthCm: centimetresSchema.parse(50),
      message: { en: 'Hi' },
      photo: null,
    },
  });
  expect(birthSettings({ ...draft, born: false }, 'Europe/Rome')).toStrictEqual({ born: false, details: null });
});

test('saving the Birth from its dialog keeps the saved Site, with the name and Sex as typed', () => {
  const waiting: SiteSettings = { ...emma, birth: { born: false, details: null }, milestones: [scan] };
  const born: BirthDraft = { ...birthDraftOf(emma) };
  const after = birthWrite(waiting, born, { babyName: 'Sofia', sex: 'female', birthVideo: null });
  expect(after.babyName).toBe('Sofia');
  expect(after.birth.born).toBe(true);
  expect(after.milestones.map((m) => [m.kind, m.date])).toStrictEqual([
    [undefined, '2026-08-01'],
    ['birth', '2026-10-26'],
  ]);
  const undone = birthWrite(emma, { ...born, born: false }, { babyName: 'Emma', sex: 'female', birthVideo: null });
  expect(undone.birth).toStrictEqual({ born: false, details: null });
  expect(undone.milestones).toStrictEqual([scan]);
});

test('the Birth milestone follows the saved day, and one removed here stays removed', () => {
  const drafts = draftOfSite(emma).milestones;
  const savedOne = { ...birthMilestone, date: asDay('2026-10-24') };
  expect(withSavedBirthMilestone(drafts, [scan, savedOne], false)[1].date).toBe('2026-10-24');
  const withoutIt = drafts.filter((m) => m.kind !== 'birth');
  expect(withSavedBirthMilestone(withoutIt, [scan, savedOne], true).length).toBe(1);
  expect(withSavedBirthMilestone(withoutIt, [scan, savedOne], false).length).toBe(2);
  expect(withSavedBirthMilestone(drafts, [scan], false).length).toBe(1);
});

test('a draft is unsaved once it would save something else', () => {
  const draft = draftOfSite(emma);
  const birth = birthOf(emma);
  expect(sameDraft(draft, birth, draftOfSite(emma), birth)).toBe(true);
  expect(sameDraft({ ...draft, babyName: 'Sofia' }, birth, draft, birth)).toBe(false);
  // The emoji kept while the loading baby is picked is not saved, so changing it changes nothing.
  const off = { ...draft, iconIsEmoji: false };
  expect(sameDraft({ ...off, iconEmoji: '🐣' }, birth, off, birth)).toBe(true);
  // Blank texts are not saved either.
  expect(sameDraft({ ...draft, pageName: { en: 'The Rossis', it: ' ' } }, birth, draft, birth)).toBe(true);
  // A Place typed and not picked is unsaved, though it sends nothing yet.
  const typed = { ...draft, milestones: draft.milestones.map((m, i) => (i === 0 ? { ...m, placeText: 'Via' } : m)) };
  expect(sameDraft(typed, birth, draft, birth)).toBe(false);
  // A video picked and not uploaded is unsaved.
  const file = new File(['x'], 'hello.mp4', { type: 'video/mp4', lastModified: 1 });
  expect(sameDraft(draft, { ...birth, birthVideo: file }, draft, birth)).toBe(false);
  expect(sameDraft(draft, { ...birth, birthVideo: file }, draft, { ...birth, birthVideo: file })).toBe(true);
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
