import { expect, test } from 'vitest';
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
  expect(next).toStrictEqual([
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
  expect(next.filter((m) => m.kind === 'birth').length).toBe(1);
  expect(next.find((m) => m.kind === 'birth')?.date).toBe('2026-10-26');
});

test('going back to the Countdown removes only the Birth milestone', () => {
  const birth: Milestone = {
    emoji: asEmoji('👶'),
    label: { en: 'She is born!' },
    date: asDay('2026-10-26'),
    kind: 'birth',
  };
  expect(
    syncBirthMilestone([scan, birth], { ...change, wasBorn: true, born: false, date: asDay('2026-10-26') }, same)
  ).toStrictEqual([scan]);
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
  expect(moved).toStrictEqual({ ...birth, date: '2026-10-25' });
});

test('the preview of the birth notification reads well before the name is given', () => {
  const messages = birthNotificationMessages({ babyName: '', sex: 'female', languages: ['it', 'en'] }, {});
  expect(messages.it?.title).toBe('È nata!');
  expect(messages.en?.title).toBe('The baby is born!');
});

test('the day of birth is the one in the Site’s Timezone', () => {
  expect(birthDay('2026-10-25T20:00:00.000Z', 'Pacific/Auckland')).toBe('2026-10-26');
  expect(birthDay('2026-10-25T20:00:00.000Z', 'America/Los_Angeles')).toBe('2026-10-25');
  expect(birthDay('', 'Europe/Rome')).toBe(null);
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
  expect(settledBirthMilestones([scan, birth], born, 'Pacific/Auckland')).toStrictEqual([
    scan,
    { ...birth, date: '2026-10-26' },
  ]);
  expect(settledBirthMilestones([scan], born, 'Pacific/Auckland')).toStrictEqual([scan]);
  expect(settledBirthMilestones([scan, birth], { born: false, details: null }, 'Europe/Rome')).toStrictEqual([scan]);
});

test('the birth time field means the wall clock in the Site’s Timezone', () => {
  expect(instantIn('2026-10-26T09:00', 'Pacific/Auckland')).toBe('2026-10-25T20:00:00.000Z');
  expect(instantIn('2026-10-25T21:00', 'Europe/Rome')).toBe('2026-10-25T20:00:00.000Z');
  expect(localIn('2026-10-25T20:00:00.000Z', 'Pacific/Auckland')).toBe('2026-10-26T09:00');
  expect(instantIn('', 'Europe/Rome')).toBe('');
  expect(instantIn('2026-10-2', 'Europe/Rome')).toBe('');
});
