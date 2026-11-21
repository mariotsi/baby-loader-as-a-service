import { expect, test } from 'vitest';
import { siteIdSchema, userIdSchema } from '../db/ids.ts';
import { slugSchema } from './address.ts';
import type { Site } from './site.ts';
import type { BirthDraft } from './siteDraft.ts';
import {
  afterBirthSave,
  afterSave,
  birthMilestoneDay,
  birthPreview,
  birthProblems,
  birthToEdit,
  bornAt,
  createSiteEditing,
  type EditorValues,
  editorValuesOf,
  holding,
  isDirty,
  previewOf,
  problemsOf,
} from './siteEditing.ts';
import { memorySiteEditingPort } from './siteEditingPort.ts';
import {
  calendarDaySchema,
  centimetresSchema,
  defaultSiteSettings,
  emojiSchema,
  gramsSchema,
  isoDateTimeSchema,
  type Milestone,
  settingsPath,
  timeZoneSchema,
} from './siteSettings.ts';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);
const NOW = new Date('2026-10-27T00:00:00Z');
const now = () => NOW;

const scan: Milestone = { emoji: asEmoji('🩺'), label: { en: 'First scan' }, date: asDay('2026-08-01') };
const birthMilestone: Milestone = {
  emoji: asEmoji('👶'),
  label: { en: 'She is born!' },
  date: asDay('2026-10-26'),
  kind: 'birth',
};

/** Emma's Site, Waiting, told in Rome. */
const waiting: Site = {
  ...structuredClone(defaultSiteSettings),
  id: siteIdSchema.parse('7a2e3d4c-5b6f-4071-9283-94a516b7c8d9'),
  ownerId: userIdSchema.parse('6f1d2c3b-4a5e-4f60-8172-839405a6b7c8'),
  slug: slugSchema.parse('emma'),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  customDomain: null,
  customDomainVerified: false,
  babyName: 'Emma',
  sex: 'female',
  dueDate: asDay('2026-11-01'),
  languages: ['en'],
  timezone: timeZoneSchema.parse('Europe/Rome'),
  milestones: [scan],
};

/** The same Site, Born on 2026-10-26 at 08:30 in Rome. */
const born: Site = {
  ...waiting,
  birth: {
    born: true,
    details: {
      datetime: isoDateTimeSchema.parse('2026-10-26T07:30:00.000Z'),
      weightGrams: gramsSchema.parse(3400),
      lengthCm: centimetresSchema.parse(50),
      message: { en: 'Welcome!' },
      photo: null,
    },
  },
  milestones: [scan, birthMilestone],
};

const mp4 = (name = 'hello.mp4') => new File(['x'], name, { type: 'video/mp4', lastModified: 1 });
const jpeg = () => new File(['x'], 'emma.jpg', { type: 'image/jpeg', lastModified: 1 });

/**
 * A Site open as the editor opens it: the store, and what the editor's form
 * holds beside it, moved on each save the way the form moves it.
 */
function open(site: Site = waiting, options: Parameters<typeof memorySiteEditingPort>[1] = {}) {
  const port = memorySiteEditingPort(site, { now, ...options });
  const editing = createSiteEditing(site, port);
  const store = () => editing.getState();
  let values = editorValuesOf(site);
  let saved = values;
  const held = () => holding(values, store());
  return {
    port,
    store,
    held,
    values: () => values,
    dirty: () => isDirty(held(), holding(saved, store())),
    change(patch: Partial<EditorValues>) {
      values = { ...values, ...patch };
    },
    /** Saves the Site settings, unless something stops the save. */
    async save() {
      const sent = values;
      const found = problemsOf(held(), NOW);
      if (found.length > 0) {
        return { ok: false as const, errors: found };
      }
      const answer = await store().save(sent);
      if (answer.ok) {
        const next = afterSave(sent, values, answer.site);
        saved = next.saved;
        values = { ...values, video: next.video };
      }
      return answer;
    },
    /** Saves `next` as the Birth, from the dialog. */
    async saveBirth(next: BirthDraft) {
      const sentVideo = values.video;
      const answer = await store().saveBirth(values, next);
      if (answer.ok) {
        const moved = afterBirthSave(saved, values, sentVideo, answer.site);
        saved = moved.saved;
        values = { ...values, milestones: moved.milestones, video: moved.video };
      }
      return answer;
    },
  };
}

/** The Birth as the dialog would hold it to announce Emma's birth. */
function announcement(page: ReturnType<typeof open>): BirthDraft {
  return { ...birthToEdit(page.held(), NOW), born: true, datetime: '2026-10-26T08:30', weight: '3400' };
}

test('a Site opens with nothing unsaved, and a change that would save something else is unsaved', () => {
  const page = open();
  expect(page.dirty()).toBe(false);
  page.change({ babyName: 'Sofia' });
  expect(page.dirty()).toBe(true);
  page.change({ babyName: 'Emma' });
  expect(page.dirty()).toBe(false);
});

test('what a save would not send is not unsaved; a Place typed and a video picked are', () => {
  const page = open();
  page.change({ pageName: { en: '  ' } });
  page.change({ iconEmoji: '🐣' });
  expect(page.dirty()).toBe(false);
  page.change({ milestones: page.values().milestones.map((m) => ({ ...m, placeText: 'Via' })) });
  expect(page.dirty()).toBe(true);
  const other = open();
  other.change({ video: mp4() });
  expect(other.dirty()).toBe(true);
});

test('a save sends every Site setting but the Birth, and leaves nothing unsaved', async () => {
  const page = open();
  page.change({ babyName: 'Sofia', palette: 'sage' });
  expect((await page.save()).ok).toBe(true);
  expect(page.port.calls).toStrictEqual(['saveSettings']);
  expect(page.port.site().babyName).toBe('Sofia');
  expect(page.store().stored.updatedAt).toBe(page.port.site().updatedAt);
  expect(page.store().lastSave).toStrictEqual({ saved: true, notification: null });
  expect([page.dirty(), page.store().stale]).toStrictEqual([false, false]);
  // The next save sends the `updatedAt` this one answered, so it is not stale.
  page.change({ babyName: 'Emma' });
  expect((await page.save()).ok).toBe(true);
  expect(page.port.site().babyName).toBe('Emma');
});

test('what stops a save is every Site settings rule, then a Place typed and never picked', () => {
  const page = open();
  expect(problemsOf(page.held(), NOW)).toStrictEqual([]);
  page.change({ dueDate: 'soon', milestones: page.values().milestones.map((m) => ({ ...m, placeText: 'Via Ro' })) });
  expect(problemsOf(page.held(), NOW).map((e) => e.path)).toStrictEqual(['dueDate', 'milestones.0.place']);
});

test('what the Owner types while a save is on its way stays unsaved', async () => {
  const page = open();
  page.change({ babyName: 'Sofia' });
  const release = page.port.holdNext();
  const saving = page.save();
  page.change({ palette: 'sage' });
  release();
  expect((await saving).ok).toBe(true);
  expect(page.port.site().babyName).toBe('Sofia');
  expect(page.port.site().theme.palette).not.toBe('sage');
  expect(page.values().palette).toBe('sage');
  expect(page.dirty()).toBe(true);
  await page.save();
  expect(page.port.site().theme.palette).toBe('sage');
  expect(page.dirty()).toBe(false);
});

test('a picked Birth video is uploaded, then saved', async () => {
  const page = open();
  page.change({ video: mp4() });
  expect((await page.save()).ok).toBe(true);
  expect(page.port.calls).toStrictEqual(['upload', 'saveSettings']);
  expect(page.port.site().birthVideo?.name).toBe('hello.mp4');
  expect(page.values().video).toStrictEqual(page.port.site().birthVideo);
  expect(page.dirty()).toBe(false);
});

test('a Birth video picked while a save is on its way is still to save', async () => {
  const page = open();
  page.change({ video: mp4() });
  const release = page.port.holdNext();
  const saving = page.save();
  const later = mp4('later.mp4');
  page.change({ video: later });
  release();
  await saving;
  expect(page.port.site().birthVideo?.name).toBe('hello.mp4');
  expect(page.values().video).toBe(later);
  expect(page.dirty()).toBe(true);
});

test('a failed upload stops the save and is reported as the route worded it', async () => {
  const page = open();
  page.change({ video: mp4() });
  page.port.refuseNext({ ok: false, refused: { code: 'mediaTooLarge' }, stale: false });
  const outcome = await page.save();
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'mediaTooLarge' }, stale: false });
  expect(page.port.calls).toStrictEqual(['upload']);
  expect(page.store().lastSave).toStrictEqual({ saved: false, refused: { code: 'mediaTooLarge' } });
  expect([page.dirty(), page.store().stale]).toStrictEqual([true, false]);
});

test('a save from a tab that missed a change elsewhere is stale, and keeps what it holds', async () => {
  const page = open();
  page.change({ babyName: 'Sofia' });
  page.port.changeElsewhere();
  const outcome = await page.save();
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'staleSite' }, stale: true });
  expect(page.store().stale).toBe(true);
  expect(page.store().lastSave).toStrictEqual({ saved: false, refused: { code: 'staleSite' } });
  expect(page.port.site().babyName).toBe('Emma');
  expect(page.dirty()).toBe(true);
});

test('Site settings errors the server finds come back for the form to mark, and report nothing in words', async () => {
  const page = open();
  page.change({ babyName: 'Sofia' });
  const errors = [{ path: settingsPath('timezone'), code: 'invalidOption' as const }];
  page.port.refuseNext({ ok: false, errors });
  expect(await page.save()).toStrictEqual({ ok: false, errors });
  expect(page.store().lastSave).toBe(null);
});

test('announcing the birth saves it with the name and the Sex as typed, and leaves the page’s other changes unsaved', async () => {
  const page = open(waiting, { notification: { sent: 3, removed: 0, total: 4 } });
  page.change({ babyName: 'Sofia', palette: 'sage' });
  expect((await page.saveBirth(announcement(page))).ok).toBe(true);
  expect(page.port.calls).toStrictEqual(['setBirth']);
  expect(page.port.site().babyName).toBe('Sofia');
  expect(page.port.site().birth.details?.datetime).toBe('2026-10-26T07:30:00.000Z');
  expect(page.port.site().theme.palette).not.toBe('sage');
  expect(page.store().lastSave).toStrictEqual({ saved: true, notification: { sent: 3, removed: 0, total: 4 } });
  expect(page.store().birth.born).toBe(true);
  expect(bornAt(page.held())).toBe('2026-10-26T07:30:00.000Z');
  // The Birth milestone the server added is on the page, and is not an unsaved change.
  expect(page.values().milestones.map((m) => [m.kind, m.date])).toStrictEqual([
    [undefined, '2026-08-01'],
    ['birth', '2026-10-26'],
  ]);
  expect(page.dirty()).toBe(true);
  page.change({ palette: waiting.theme.palette });
  expect(page.dirty()).toBe(false);
});

test('the Birth’s time is read in the saved Timezone, whatever Timezone the page holds unsaved', async () => {
  const page = open();
  page.change({ timezone: 'Pacific/Auckland' });
  await page.saveBirth(announcement(page));
  expect(page.port.site().birth.details?.datetime).toBe('2026-10-26T07:30:00.000Z');
  // The Birth milestone's day is told in the Timezone as typed: 08:30 in Rome is the evening in Auckland.
  expect(birthMilestoneDay(page.held())).toBe('2026-10-26');
  page.change({ timezone: 'America/Los_Angeles' });
  expect(birthMilestoneDay(page.held())).toBe('2026-10-26');
  expect(birthMilestoneDay(open().held())).toBe(null);
});

test('a Birth milestone the Owner removed and has not saved stays removed when the Birth is saved', async () => {
  const page = open(born);
  page.change({ milestones: page.values().milestones.filter((m) => m.kind !== 'birth') });
  expect((await page.saveBirth({ ...page.store().birth, weight: '3500' })).ok).toBe(true);
  expect(page.port.site().birth.details?.weightGrams).toBe(3500);
  expect(page.values().milestones.map((m) => m.kind)).toStrictEqual([undefined]);
  expect(page.dirty()).toBe(true);
});

test('the Birth milestone follows the saved day and keeps the label the Owner has not saved', async () => {
  const page = open(born);
  page.change({
    milestones: page.values().milestones.map((m) => (m.kind === 'birth' ? { ...m, label: { en: 'Hello Emma' } } : m)),
  });
  await page.saveBirth({ ...page.store().birth, datetime: '2026-10-24T08:30' });
  const milestone = page.values().milestones.find((m) => m.kind === 'birth');
  expect([milestone?.date, milestone?.label]).toStrictEqual(['2026-10-24', { en: 'Hello Emma' }]);
  expect(page.dirty()).toBe(true);
});

test('going back to the Countdown clears the Birth and its milestone, and keeps the Birth video', async () => {
  const video = {
    key: `customer-data/${born.ownerId}/${born.id}/9c4a5f6e-7d81-4293-b4a5-b6c7d8e9f0a1`,
    url: 'https://media.example/v',
  };
  const page = open({ ...born, birthVideo: video as Site['birthVideo'] });
  expect((await page.saveBirth({ ...page.store().birth, born: false })).ok).toBe(true);
  expect(page.port.calls).toStrictEqual(['clearBirth']);
  expect(page.store().birth.born).toBe(false);
  expect(bornAt(page.held())).toBe(null);
  expect(page.values().milestones.map((m) => m.kind)).toStrictEqual([undefined]);
  expect(page.values().video).toStrictEqual(video);
  expect(page.store().lastSave).toStrictEqual({ saved: true, notification: null });
  expect(page.dirty()).toBe(false);
});

test('a Birth save uploads the photo, then the video, then sets the Birth', async () => {
  const page = open();
  page.change({ video: mp4() });
  await page.saveBirth({ ...announcement(page), photo: jpeg() });
  expect(page.port.calls).toStrictEqual(['upload', 'upload', 'setBirth']);
  expect(page.port.site().birth.details?.photo?.name).toBe('emma.jpg');
  expect(page.port.site().birthVideo?.name).toBe('hello.mp4');
  expect(page.store().birth.photo).toStrictEqual(page.port.site().birth.details?.photo);
  expect(page.dirty()).toBe(false);
});

test('a Birth save that fails answers its dialog, and the page reports nothing of its own', async () => {
  const page = open();
  page.port.changeElsewhere();
  const outcome = await page.saveBirth(announcement(page));
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'staleSite' }, stale: true });
  expect(page.store().lastSave).toBe(null);
  expect([page.store().stale, page.store().birth.born]).toStrictEqual([true, false]);
});

test('the Birth dialog is told what stops its Birth, and what its previews draw', () => {
  const page = open();
  const birth = announcement(page);
  expect(birthProblems(page.held(), birth, NOW)).toStrictEqual([]);
  expect(birthPreview(page.held(), birth, NOW)?.birth.born).toBe(true);
  expect(birthProblems(page.held(), { ...birth, datetime: '' }, NOW).map((e) => e.path)).toStrictEqual([
    'birth.details.datetime',
  ]);
  expect(birthPreview(page.held(), { ...birth, datetime: '' }, NOW)).toBe(null);
  // Announcing asks for the name: its absence stops the save, and the previews still draw.
  page.change({ babyName: '' });
  expect(birthProblems(page.held(), birth, NOW).map((e) => e.path)).toStrictEqual(['babyName']);
  expect(birthPreview(page.held(), birth, NOW)?.babyName).toBe('');
  // The page's other unsaved changes are not the dialog's to save or to check.
  page.change({ babyName: 'Emma', dueDate: 'soon' });
  expect(birthProblems(page.held(), birth, NOW)).toStrictEqual([]);
});

test('announcing starts from now on the wall clock in the saved Timezone; a saved Birth opens as saved', () => {
  expect(birthToEdit(open().held(), NOW).datetime).toBe('2026-10-27T01:00');
  const saved = open(born).held();
  expect(birthToEdit(saved, NOW)).toBe(saved.birth);
  expect(saved.birth.datetime).toBe('2026-10-26T08:30');
});

test('previews keep the last valid settings while a field is half filled', () => {
  const page = open();
  page.change({ babyName: 'Sofia' });
  const whole = previewOf(page.held(), waiting, NOW);
  expect(whole.babyName).toBe('Sofia');
  page.change({ babyName: 'Sofia Maria', dueDate: '2026-11-0' });
  expect(previewOf(page.held(), whole, NOW)).toBe(whole);
  page.change({ dueDate: '2026-11-03' });
  const next = previewOf(page.held(), whole, NOW);
  expect([next.babyName, next.dueDate]).toStrictEqual(['Sofia Maria', '2026-11-03']);
});

test('a Born Site opens with its Birth on the wall clock in its Timezone, and a Birth save sends the fields as typed', async () => {
  const page = open(born);
  expect(page.dirty()).toBe(false);
  const { birth } = page.store();
  expect([birth.datetime, birth.weight, birth.lengthCm]).toStrictEqual(['2026-10-26T08:30', '3400', '50']);
  await page.saveBirth({ ...birth, weight: '', message: { en: 'Hi', it: ' ' } });
  expect(page.port.site().birth.details).toStrictEqual({
    datetime: '2026-10-26T07:30:00.000Z',
    weightGrams: null,
    lengthCm: 50,
    message: { en: 'Hi' },
    photo: null,
  });
  expect(page.dirty()).toBe(false);
});
