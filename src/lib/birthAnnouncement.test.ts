import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIRTH_MILESTONE_EMOJI, syncBirthMilestone } from './birthAnnouncement.ts';
import type { Milestone } from './siteSettings.ts';

const scan: Milestone = { emoji: '🩺', label: { en: 'First scan' }, date: '2026-08-01' };
const same = (m: Milestone) => m;
const change = { languages: ['it', 'en'] as const, sex: 'female' as const };

test('announcing adds the Birth milestone on the day of birth, in every Language', () => {
  const next = syncBirthMilestone([scan], { ...change, wasBorn: false, born: true, date: '2026-10-26' }, same);
  assert.deepEqual(next, [
    scan,
    { emoji: BIRTH_MILESTONE_EMOJI, label: { it: 'È nata!', en: 'She is born!' }, date: '2026-10-26', kind: 'birth' },
  ]);
});

test('announcing again replaces the Birth milestone left from before', () => {
  const old: Milestone = { emoji: '🎉', label: { en: 'Here!' }, date: '2026-10-20', kind: 'birth' };
  const next = syncBirthMilestone([old, scan], { ...change, wasBorn: false, born: true, date: '2026-10-26' }, same);
  assert.equal(next.filter((m) => m.kind === 'birth').length, 1);
  assert.equal(next.find((m) => m.kind === 'birth')?.date, '2026-10-26');
});

test('going back to the Countdown removes only the Birth milestone', () => {
  const birth: Milestone = { emoji: '👶', label: { en: 'She is born!' }, date: '2026-10-26', kind: 'birth' };
  assert.deepEqual(syncBirthMilestone([scan, birth], { ...change, wasBorn: true, born: false, date: '' }, same), [
    scan,
  ]);
});

test('a new day of birth moves the Birth milestone and keeps what the Owner wrote', () => {
  const birth: Milestone = { emoji: '🎀', label: { en: 'Our girl' }, date: '2026-10-26', kind: 'birth' };
  const [, moved] = syncBirthMilestone(
    [scan, birth],
    { ...change, wasBorn: true, born: true, date: '2026-10-25' },
    same
  );
  assert.deepEqual(moved, { ...birth, date: '2026-10-25' });
});
