import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BIRTH_MILESTONE_EMOJI,
  birthDay,
  birthNotificationMessages,
  instantIn,
  localIn,
  settledBirthMilestones,
  syncBirthMilestone,
} from './birthAnnouncement.ts';
import type { Milestone } from './siteSettings.ts';
import { calendarDaySchema, emojiSchema } from './siteSettings.ts';

const asDay = (value: string) => calendarDaySchema.parse(value);
const asEmoji = (value: string) => emojiSchema.parse(value);

const scan: Milestone = { emoji: asEmoji('🩺'), label: { en: 'First scan' }, date: asDay('2026-08-01') };
const same = (m: Milestone) => m;
const change = { languages: ['it', 'en'] as const, sex: 'female' as const };

test('announcing adds the Birth milestone on the day of birth, in every Language', () => {
  const next = syncBirthMilestone([scan], { ...change, wasBorn: false, born: true, date: asDay('2026-10-26') }, same);
  assert.deepEqual(next, [
    scan,
    { emoji: BIRTH_MILESTONE_EMOJI, label: { it: 'È nata!', en: 'She is born!' }, date: '2026-10-26', kind: 'birth' },
  ]);
});

test('announcing again replaces the Birth milestone left from before', () => {
  const old: Milestone = { emoji: asEmoji('🎉'), label: { en: 'Here!' }, date: asDay('2026-10-20'), kind: 'birth' };
  const next = syncBirthMilestone(
    [old, scan],
    { ...change, wasBorn: false, born: true, date: asDay('2026-10-26') },
    same
  );
  assert.equal(next.filter((m) => m.kind === 'birth').length, 1);
  assert.equal(next.find((m) => m.kind === 'birth')?.date, '2026-10-26');
});

test('going back to the Countdown removes only the Birth milestone', () => {
  const birth: Milestone = {
    emoji: asEmoji('👶'),
    label: { en: 'She is born!' },
    date: asDay('2026-10-26'),
    kind: 'birth',
  };
  assert.deepEqual(
    syncBirthMilestone([scan, birth], { ...change, wasBorn: true, born: false, date: asDay('2026-10-26') }, same),
    [scan]
  );
});

test('a new day of birth moves the Birth milestone and keeps what the Owner wrote', () => {
  const birth: Milestone = {
    emoji: asEmoji('🎀'),
    label: { en: 'Our girl' },
    date: asDay('2026-10-26'),
    kind: 'birth',
  };
  const [, moved] = syncBirthMilestone(
    [scan, birth],
    { ...change, wasBorn: true, born: true, date: asDay('2026-10-25') },
    same
  );
  assert.deepEqual(moved, { ...birth, date: '2026-10-25' });
});

test('the preview of the birth notification reads well before the name is given', () => {
  const messages = birthNotificationMessages({ babyName: '', sex: 'female', languages: ['it', 'en'] }, {});
  assert.equal(messages.it?.title, 'È nata!');
  assert.equal(messages.en?.title, 'The baby is born!');
});

test('the day of birth is the one in the Site’s Timezone', () => {
  assert.equal(birthDay('2026-10-25T20:00:00.000Z', 'Pacific/Auckland'), '2026-10-26');
  assert.equal(birthDay('2026-10-25T20:00:00.000Z', 'America/Los_Angeles'), '2026-10-25');
  assert.equal(birthDay('', 'Europe/Rome'), null);
});

test('Site settings saved apart from the Birth keep the Birth milestone on the day of birth, and none while Waiting', () => {
  const birth: Milestone = {
    emoji: asEmoji('🎀'),
    label: { en: 'Our girl' },
    date: asDay('2026-01-01'),
    kind: 'birth',
  };
  const born = {
    born: true as const,
    details: { datetime: '2026-10-25T20:00:00.000Z', weightGrams: null, lengthCm: null, message: {} },
  };
  assert.deepEqual(settledBirthMilestones([scan, birth], born, 'Pacific/Auckland'), [
    scan,
    { ...birth, date: '2026-10-26' },
  ]);
  assert.deepEqual(settledBirthMilestones([scan], born, 'Pacific/Auckland'), [scan]);
  assert.deepEqual(settledBirthMilestones([scan, birth], { born: false, details: null }, 'Europe/Rome'), [scan]);
});

test('the birth time field means the wall clock in the Site’s Timezone', () => {
  assert.equal(instantIn('2026-10-26T09:00', 'Pacific/Auckland'), '2026-10-25T20:00:00.000Z');
  assert.equal(instantIn('2026-10-25T21:00', 'Europe/Rome'), '2026-10-25T20:00:00.000Z');
  assert.equal(localIn('2026-10-25T20:00:00.000Z', 'Pacific/Auckland'), '2026-10-26T09:00');
  assert.equal(instantIn('', 'Europe/Rome'), '');
  assert.equal(instantIn('2026-10-2', 'Europe/Rome'), '');
});
