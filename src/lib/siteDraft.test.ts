import assert from 'node:assert/strict';
import { test } from 'node:test';
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
  DEFAULT_SITE_ICON_EMOJI,
  defaultSiteSettings,
  emojiSchema,
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
      weightGrams: 3400,
      lengthCm: 50,
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
  assert.deepEqual(settings, {
    ...emma,
    pageName: { en: 'The Rossis' },
    milestones: [{ ...scan, label: { en: 'First scan' } }, birthMilestone],
  });
  assert.equal(parseSiteSettings(settings, NOW).ok, true);
});

test('a draft holds the fields as a form shows them', () => {
  const draft = draftOfSite({ ...emma, dueDate: null, icon: null });
  assert.equal(draft.dueDate, '');
  assert.equal(draft.iconIsEmoji, false);
  assert.equal(draft.iconEmoji, DEFAULT_SITE_ICON_EMOJI);
  assert.deepEqual(
    draft.milestones.map((m) => m.placeText),
    ['', '']
  );
  const placed = draftOfSite({ ...emma, milestones: [{ ...scan, place: { address: 'Via Roma 1', lat: 1, lon: 2 } }] });
  assert.equal(placed.milestones[0].placeText, 'Via Roma 1');
});

test('a new Site starts Waiting, in the Owner’s Language and their browser’s Timezone', () => {
  const draft = newSiteDraft('it', 'Europe/Rome');
  const settings = settingsOfDraft({ ...draft, dueDate: '2026-12-01' });
  assert.deepEqual(settings.languages, ['it']);
  assert.equal(settings.timezone, 'Europe/Rome');
  assert.deepEqual(settings.birth, { born: false, details: null });
  assert.equal(settings.birthVideo, null);
  assert.equal(settings.icon, null);
  assert.equal(parseSiteSettings(settings, new Date('2026-10-20T12:00:00Z')).ok, true);
});

test('the Site icon keeps its emoji while the loading baby is picked, and sends it only when picked', () => {
  const draft = draftOfSite(emma);
  assert.equal(settingsOfDraft({ ...draft, iconIsEmoji: false }).icon, null);
  assert.equal(draftOfSite({ ...emma, icon: null }).iconEmoji, DEFAULT_SITE_ICON_EMOJI);
  const back = { ...draft, iconIsEmoji: false };
  assert.equal(settingsOfDraft({ ...back, iconIsEmoji: true }).icon, '🎀');
});

test('blank texts are dropped, and a text in a Language the Site no longer speaks is kept', () => {
  const draft: SiteDraft = { ...draftOfSite(emma), languages: ['en'], pageName: { en: '  ', it: 'I Rossi' } };
  assert.deepEqual(settingsOfDraft(draft).pageName, { it: 'I Rossi' });
});

test('the Birth milestone stands on the day of birth in the Site’s Timezone, and goes while Waiting', () => {
  const draft: SiteDraft = {
    ...draftOfSite(emma),
    milestones: draftOfSite(emma).milestones.map((m) => (m.kind === 'birth' ? { ...m, date: '2026-01-01' } : m)),
  };
  assert.equal(settingsOfDraft(draft, birthOf(emma)).milestones[1].date, '2026-10-26');
  assert.equal(
    settingsOfDraft({ ...draft, timezone: 'America/Los_Angeles' }, birthOf(emma)).milestones[1].date,
    '2026-10-25'
  );
  assert.deepEqual(
    settingsOfDraft(draft).milestones.map((m) => m.kind),
    [undefined]
  );
});

test('the Birth’s time is typed on the wall clock in the Site’s Timezone', () => {
  const draft = birthDraftOf(emma);
  assert.equal(draft.datetime, '2026-10-26T09:00');
  assert.deepEqual([draft.weight, draft.lengthCm], ['3400', '50']);
  const settings = birthSettings({ ...draft, weight: '', message: { en: 'Hi', it: ' ' } }, 'Europe/Rome');
  assert.deepEqual(settings, {
    born: true,
    details: {
      datetime: '2026-10-26T08:00:00.000Z',
      weightGrams: null,
      lengthCm: 50,
      message: { en: 'Hi' },
      photo: null,
    },
  });
  assert.deepEqual(birthSettings({ ...draft, born: false }, 'Europe/Rome'), { born: false, details: null });
});

test('saving the Birth from its dialog keeps the saved Site, with the name and Sex as typed', () => {
  const waiting: SiteSettings = { ...emma, birth: { born: false, details: null }, milestones: [scan] };
  const born: BirthDraft = { ...birthDraftOf(emma) };
  const after = birthWrite(waiting, born, { babyName: 'Sofia', sex: 'female', birthVideo: null });
  assert.equal(after.babyName, 'Sofia');
  assert.equal(after.birth.born, true);
  assert.deepEqual(
    after.milestones.map((m) => [m.kind, m.date]),
    [
      [undefined, '2026-08-01'],
      ['birth', '2026-10-26'],
    ]
  );
  const undone = birthWrite(emma, { ...born, born: false }, { babyName: 'Emma', sex: 'female', birthVideo: null });
  assert.deepEqual(undone.birth, { born: false, details: null });
  assert.deepEqual(undone.milestones, [scan]);
});

test('the Birth milestone follows the saved day, and one removed here stays removed', () => {
  const drafts = draftOfSite(emma).milestones;
  const savedOne = { ...birthMilestone, date: asDay('2026-10-24') };
  assert.equal(withSavedBirthMilestone(drafts, [scan, savedOne], false)[1].date, '2026-10-24');
  const withoutIt = drafts.filter((m) => m.kind !== 'birth');
  assert.equal(withSavedBirthMilestone(withoutIt, [scan, savedOne], true).length, 1);
  assert.equal(withSavedBirthMilestone(withoutIt, [scan, savedOne], false).length, 2);
  assert.equal(withSavedBirthMilestone(drafts, [scan], false).length, 1);
});

test('a draft is unsaved once it would save something else', () => {
  const draft = draftOfSite(emma);
  const birth = birthOf(emma);
  assert.equal(sameDraft(draft, birth, draftOfSite(emma), birth), true);
  assert.equal(sameDraft({ ...draft, babyName: 'Sofia' }, birth, draft, birth), false);
  // The emoji kept while the loading baby is picked is not saved, so changing it changes nothing.
  const off = { ...draft, iconIsEmoji: false };
  assert.equal(sameDraft({ ...off, iconEmoji: '🐣' }, birth, off, birth), true);
  // Blank texts are not saved either.
  assert.equal(sameDraft({ ...draft, pageName: { en: 'The Rossis', it: ' ' } }, birth, draft, birth), true);
  // A Place typed and not picked is unsaved, though it sends nothing yet.
  const typed = { ...draft, milestones: draft.milestones.map((m, i) => (i === 0 ? { ...m, placeText: 'Via' } : m)) };
  assert.equal(sameDraft(typed, birth, draft, birth), false);
  // A video picked and not uploaded is unsaved.
  const file = new File(['x'], 'hello.mp4', { type: 'video/mp4', lastModified: 1 });
  assert.equal(sameDraft(draft, { ...birth, birthVideo: file }, draft, birth), false);
  assert.equal(sameDraft(draft, { ...birth, birthVideo: file }, draft, { ...birth, birthVideo: file }), true);
});

test('previews keep the last valid settings while a field is half filled', () => {
  const first = lastValidSettings(settingsOfDraft(draftOfSite(emma), birthOf(emma)), defaultSiteSettings, NOW);
  assert.equal(first.babyName, 'Emma');
  const halfFilled = settingsOfDraft({ ...draftOfSite(emma), babyName: 'Sofia', dueDate: '2026-02-3' }, birthOf(emma));
  assert.equal(lastValidSettings(halfFilled, first, NOW), first);
});

test('a Place typed and never picked stops a save', () => {
  const draft = draftOfSite({ ...emma, birth: { born: false, details: null }, milestones: [scan] });
  const typed = { ...draft, milestones: [{ ...draft.milestones[0], placeText: 'Via Ro' }] };
  assert.deepEqual(unpickedPlaces(typed.milestones), [{ path: 'milestones.0.place', code: 'invalidOption' }]);
  assert.deepEqual(
    draftProblems(typed, undefined, NOW).map((e) => e.path),
    ['milestones.0.place']
  );
  assert.deepEqual(
    draftProblems({ ...typed, dueDate: 'soon' }, undefined, NOW).map((e) => e.path),
    ['dueDate', 'milestones.0.place']
  );
});

test('a stored draft is read back only in the shape this module writes', () => {
  const draft = newSiteDraft('en', 'Europe/Rome');
  assert.deepEqual(readStoredDraft(JSON.parse(JSON.stringify(draft))), draft);
  const older = { slug: 'emma', babyName: '', sex: 'unknown', dueDate: '', languages: ['en'] };
  assert.equal(readStoredDraft(older), null);
  assert.equal(readStoredDraft(null), null);
});
