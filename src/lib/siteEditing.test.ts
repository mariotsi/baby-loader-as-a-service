import { expect, test } from 'vitest';
import { siteIdSchema, userIdSchema } from '../db/ids.ts';
import { slugSchema } from './address.ts';
import type { Site } from './site.ts';
import {
  birthMilestoneDay,
  birthPreview,
  birthProblems,
  birthToEdit,
  bornAt,
  createSiteEditing,
  isDirty,
  liveErrors,
  stillFailing,
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

function open(site: Site = waiting, options: Parameters<typeof memorySiteEditingPort>[1] = {}) {
  const port = memorySiteEditingPort(site, { now, ...options });
  const editing = createSiteEditing(site, port, now);
  return { port, editing, state: () => editing.getState() };
}

/** The Birth as the dialog would hold it to announce Emma's birth. */
function announcement(state: ReturnType<ReturnType<typeof open>['state']>) {
  return { ...birthToEdit(state, NOW), born: true, datetime: '2026-10-26T08:30', weight: '3400' };
}

test('a Site opens with nothing unsaved, and a change that would save something else is unsaved', () => {
  const { state } = open();
  expect(isDirty(state())).toBe(false);
  state().change({ babyName: 'Sofia' });
  expect(isDirty(state())).toBe(true);
  state().change({ babyName: 'Emma' });
  expect(isDirty(state())).toBe(false);
});

test('what a save would not send is not unsaved; a Place typed and a video picked are', () => {
  const { state } = open();
  state().change({ pageName: { en: '  ' } });
  state().change({ iconEmoji: '🐣' });
  expect(isDirty(state())).toBe(false);
  state().change({ milestones: state().draft.milestones.map((m) => ({ ...m, placeText: 'Via' })) });
  expect(isDirty(state())).toBe(true);
  const other = open();
  other.state().pickVideo(mp4());
  expect(isDirty(other.state())).toBe(true);
});

test('a save sends every Site setting but the Birth, and leaves nothing unsaved', async () => {
  const { port, state } = open();
  state().change({ babyName: 'Sofia', palette: 'sage' });
  expect(await state().save()).toStrictEqual({ ok: true });
  expect(port.calls).toStrictEqual(['saveSettings']);
  expect(port.site().babyName).toBe('Sofia');
  expect(state().stored.updatedAt).toBe(port.site().updatedAt);
  expect(state().lastSave).toStrictEqual({ saved: true, notification: null });
  expect([isDirty(state()), state().saving, state().stale]).toStrictEqual([false, false, false]);
  // The next save sends the `updatedAt` this one answered, so it is not stale.
  state().change({ babyName: 'Emma' });
  expect(await state().save()).toStrictEqual({ ok: true });
  expect(port.site().babyName).toBe('Emma');
});

test('what stops a save is marked and nothing is sent; only the marked fields are checked while they are fixed', async () => {
  const { port, state } = open();
  state().change({ dueDate: 'soon' });
  const outcome = await state().save();
  expect(outcome.ok).toBe(false);
  expect(port.calls).toStrictEqual([]);
  expect(state().failedPaths).toStrictEqual(['dueDate']);
  expect(state().failedSaves).toBe(1);
  expect(liveErrors(state(), NOW).map((e) => e.path)).toStrictEqual(['dueDate']);
  // A Place typed and never picked is wrong too, but it did not fail the last save: it stays unmarked.
  state().change({ milestones: state().draft.milestones.map((m) => ({ ...m, placeText: 'Via Ro' })) });
  expect(liveErrors(state(), NOW).map((e) => e.path)).toStrictEqual(['dueDate']);
  state().change({ dueDate: '2026-11-02' });
  expect(liveErrors(state(), NOW)).toStrictEqual([]);
  // The next save finds the Place and marks it.
  await state().save();
  expect(state().failedPaths).toStrictEqual(['milestones.0.place']);
  expect(state().failedSaves).toBe(2);
});

test('the errors a form still shows are those on a field that failed its last save', () => {
  const found = [
    { path: settingsPath('dueDate'), code: 'invalidType' as const },
    { path: settingsPath('babyName'), code: 'required' as const },
  ];
  expect(stillFailing(found, [])).toStrictEqual([]);
  expect(stillFailing(found, ['babyName', 'timezone'])).toStrictEqual([found[1]]);
});

test('what the Owner types while a save is on its way stays unsaved', async () => {
  const { port, state } = open();
  state().change({ babyName: 'Sofia' });
  const release = port.holdNext();
  const saving = state().save();
  expect(state().saving).toBe(true);
  state().change({ palette: 'sage' });
  release();
  expect(await saving).toStrictEqual({ ok: true });
  expect(port.site().babyName).toBe('Sofia');
  expect(port.site().theme.palette).not.toBe('sage');
  expect(state().draft.palette).toBe('sage');
  expect(isDirty(state())).toBe(true);
  await state().save();
  expect(port.site().theme.palette).toBe('sage');
  expect(isDirty(state())).toBe(false);
});

test('a picked Birth video is uploaded, then saved', async () => {
  const { port, state } = open();
  state().pickVideo(mp4());
  expect(await state().save()).toStrictEqual({ ok: true });
  expect(port.calls).toStrictEqual(['upload', 'saveSettings']);
  expect(port.site().birthVideo?.name).toBe('hello.mp4');
  expect(state().video).toStrictEqual(port.site().birthVideo);
  expect(isDirty(state())).toBe(false);
});

test('a failed upload stops the save and is reported as the route worded it', async () => {
  const { port, state } = open();
  state().pickVideo(mp4());
  port.refuseNext({ ok: false, refused: { code: 'mediaTooLarge' }, stale: false });
  const outcome = await state().save();
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'mediaTooLarge' }, stale: false });
  expect(port.calls).toStrictEqual(['upload']);
  expect(state().lastSave).toStrictEqual({ saved: false, refused: { code: 'mediaTooLarge' } });
  expect([isDirty(state()), state().saving, state().stale]).toStrictEqual([true, false, false]);
});

test('a save from a tab that missed a change elsewhere is stale, and keeps what it holds', async () => {
  const { port, state } = open();
  state().change({ babyName: 'Sofia' });
  port.changeElsewhere();
  const outcome = await state().save();
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'staleSite' }, stale: true });
  expect(state().stale).toBe(true);
  expect(state().lastSave).toStrictEqual({ saved: false, refused: { code: 'staleSite' } });
  expect(port.site().babyName).toBe('Emma');
  expect(isDirty(state())).toBe(true);
});

test('Site settings errors the server finds mark their fields and report nothing in words', async () => {
  const { port, state } = open();
  state().change({ babyName: 'Sofia' });
  port.refuseNext({ ok: false, errors: [{ path: settingsPath('timezone'), code: 'invalidOption' }] });
  expect((await state().save()).ok).toBe(false);
  expect(state().failedPaths).toStrictEqual(['timezone']);
  expect(state().lastSave).toBe(null);
});

test('announcing the birth saves it with the name and the Sex as typed, and leaves the page’s other changes unsaved', async () => {
  const { port, state } = open(waiting, { notification: { sent: 3, removed: 0, total: 4 } });
  state().change({ babyName: 'Sofia', palette: 'sage' });
  expect(await state().saveBirth(announcement(state()))).toStrictEqual({ ok: true });
  expect(port.calls).toStrictEqual(['setBirth']);
  expect(port.site().babyName).toBe('Sofia');
  expect(port.site().birth.details?.datetime).toBe('2026-10-26T07:30:00.000Z');
  expect(port.site().theme.palette).not.toBe('sage');
  expect(state().lastSave).toStrictEqual({ saved: true, notification: { sent: 3, removed: 0, total: 4 } });
  expect(state().birth.born).toBe(true);
  expect(bornAt(state())).toBe('2026-10-26T07:30:00.000Z');
  // The Birth milestone the server added is on the page, and is not an unsaved change.
  expect(state().draft.milestones.map((m) => [m.kind, m.date])).toStrictEqual([
    [undefined, '2026-08-01'],
    ['birth', '2026-10-26'],
  ]);
  expect(isDirty(state())).toBe(true);
  state().change({ palette: waiting.theme.palette });
  expect(isDirty(state())).toBe(false);
});

test('the Birth’s time is read in the saved Timezone, whatever Timezone the page holds unsaved', async () => {
  const { port, state } = open();
  state().change({ timezone: 'Pacific/Auckland' });
  await state().saveBirth(announcement(state()));
  expect(port.site().birth.details?.datetime).toBe('2026-10-26T07:30:00.000Z');
  // The Birth milestone's day is told in the Timezone as typed: 08:30 in Rome is the evening in Auckland.
  expect(birthMilestoneDay(state())).toBe('2026-10-26');
  state().change({ timezone: 'America/Los_Angeles' });
  expect(birthMilestoneDay(state())).toBe('2026-10-26');
  expect(birthMilestoneDay(open().state())).toBe(null);
});

test('a Birth milestone the Owner removed and has not saved stays removed when the Birth is saved', async () => {
  const { port, state } = open(born);
  state().change({ milestones: state().draft.milestones.filter((m) => m.kind !== 'birth') });
  expect(await state().saveBirth({ ...state().birth, weight: '3500' })).toStrictEqual({ ok: true });
  expect(port.site().birth.details?.weightGrams).toBe(3500);
  expect(state().draft.milestones.map((m) => m.kind)).toStrictEqual([undefined]);
  expect(isDirty(state())).toBe(true);
});

test('the Birth milestone follows the saved day and keeps the label the Owner has not saved', async () => {
  const { state } = open(born);
  state().change({
    milestones: state().draft.milestones.map((m) => (m.kind === 'birth' ? { ...m, label: { en: 'Hello Emma' } } : m)),
  });
  await state().saveBirth({ ...state().birth, datetime: '2026-10-24T08:30' });
  const milestone = state().draft.milestones.find((m) => m.kind === 'birth');
  expect([milestone?.date, milestone?.label]).toStrictEqual(['2026-10-24', { en: 'Hello Emma' }]);
  expect(isDirty(state())).toBe(true);
});

test('going back to the Countdown clears the Birth and its milestone, and keeps the Birth video', async () => {
  const video = {
    key: `customer-data/${born.ownerId}/${born.id}/9c4a5f6e-7d81-4293-b4a5-b6c7d8e9f0a1`,
    url: 'https://media.example/v',
  };
  const { port, state } = open({ ...born, birthVideo: video as Site['birthVideo'] });
  expect(await state().saveBirth({ ...state().birth, born: false })).toStrictEqual({ ok: true });
  expect(port.calls).toStrictEqual(['clearBirth']);
  expect(state().birth.born).toBe(false);
  expect(bornAt(state())).toBe(null);
  expect(state().draft.milestones.map((m) => m.kind)).toStrictEqual([undefined]);
  expect(state().video).toStrictEqual(video);
  expect(state().lastSave).toStrictEqual({ saved: true, notification: null });
  expect(isDirty(state())).toBe(false);
});

test('a Birth save uploads the photo, then the video, then sets the Birth', async () => {
  const { port, state } = open();
  state().pickVideo(mp4());
  await state().saveBirth({ ...announcement(state()), photo: jpeg() });
  expect(port.calls).toStrictEqual(['upload', 'upload', 'setBirth']);
  expect(port.site().birth.details?.photo?.name).toBe('emma.jpg');
  expect(port.site().birthVideo?.name).toBe('hello.mp4');
  expect(state().birth.photo).toStrictEqual(port.site().birth.details?.photo);
  expect(isDirty(state())).toBe(false);
});

test('a Birth save that fails answers its dialog, and the page reports nothing of its own', async () => {
  const { port, state } = open();
  port.changeElsewhere();
  const outcome = await state().saveBirth(announcement(state()));
  expect(outcome).toStrictEqual({ ok: false, refused: { code: 'staleSite' }, stale: true });
  expect(state().lastSave).toBe(null);
  expect([state().stale, state().saving, state().birth.born]).toStrictEqual([true, false, false]);
});

test('a Birth save clears the marks of the page’s last failed save', async () => {
  const { state } = open();
  state().change({ dueDate: 'soon' });
  await state().save();
  expect(state().failedPaths).toStrictEqual(['dueDate']);
  await state().saveBirth(announcement(state()));
  expect(state().failedPaths).toStrictEqual([]);
});

test('the Birth dialog is told what stops its Birth, and what its previews draw', () => {
  const { state } = open();
  const birth = announcement(state());
  expect(birthProblems(state(), birth, NOW)).toStrictEqual([]);
  expect(birthPreview(state(), birth, NOW)?.birth.born).toBe(true);
  expect(birthProblems(state(), { ...birth, datetime: '' }, NOW).map((e) => e.path)).toStrictEqual([
    'birth.details.datetime',
  ]);
  expect(birthPreview(state(), { ...birth, datetime: '' }, NOW)).toBe(null);
  // Announcing asks for the name: its absence stops the save, and the previews still draw.
  state().change({ babyName: '' });
  expect(birthProblems(state(), birth, NOW).map((e) => e.path)).toStrictEqual(['babyName']);
  expect(birthPreview(state(), birth, NOW)?.babyName).toBe('');
  // The page's other unsaved changes are not the dialog's to save or to check.
  state().change({ babyName: 'Emma', dueDate: 'soon' });
  expect(birthProblems(state(), birth, NOW)).toStrictEqual([]);
});

test('announcing starts from now on the wall clock in the saved Timezone; a saved Birth opens as saved', () => {
  expect(birthToEdit(open().state(), NOW).datetime).toBe('2026-10-27T01:00');
  const saved = open(born).state();
  expect(birthToEdit(saved, NOW)).toBe(saved.birth);
  expect(saved.birth.datetime).toBe('2026-10-26T08:30');
});

test('previews keep the last valid settings while a field is half filled', () => {
  const { state } = open();
  state().change({ babyName: 'Sofia' });
  expect(state().preview.babyName).toBe('Sofia');
  state().change({ babyName: 'Sofia Maria', dueDate: '2026-11-0' });
  expect(state().preview.babyName).toBe('Sofia');
  state().change({ dueDate: '2026-11-03' });
  expect([state().preview.babyName, state().preview.dueDate]).toStrictEqual(['Sofia Maria', '2026-11-03']);
});

test('a Born Site opens with its Birth on the wall clock in its Timezone, and a Birth save sends the fields as typed', async () => {
  const { port, state } = open(born);
  expect(isDirty(state())).toBe(false);
  expect([state().birth.datetime, state().birth.weight, state().birth.lengthCm]).toStrictEqual([
    '2026-10-26T08:30',
    '3400',
    '50',
  ]);
  await state().saveBirth({ ...state().birth, weight: '', message: { en: 'Hi', it: ' ' } });
  expect(port.site().birth.details).toStrictEqual({
    datetime: '2026-10-26T07:30:00.000Z',
    weightGrams: null,
    lengthCm: 50,
    message: { en: 'Hi' },
    photo: null,
  });
  expect(isDirty(state())).toBe(false);
});
