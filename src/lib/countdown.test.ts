import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countdownDays } from './countdown.ts';

test('counts calendar days to the Due date, 0 on the day, negative after it', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.equal(countdownDays('2026-10-30', 'Europe/Rome', now), 10);
  assert.equal(countdownDays('2026-10-20', 'Europe/Rome', now), 0);
  assert.equal(countdownDays('2026-10-17', 'Europe/Rome', now), -3);
});

test("changes at local midnight in the Site's Timezone, not at UTC midnight or noon", () => {
  // 23:59 and 00:00 in Rome (UTC+2 in October).
  assert.equal(countdownDays('2026-10-21', 'Europe/Rome', new Date('2026-10-20T21:59:00Z')), 1);
  assert.equal(countdownDays('2026-10-21', 'Europe/Rome', new Date('2026-10-20T22:00:00Z')), 0);
  // The same instant is still the 20th in New York (UTC-4).
  assert.equal(countdownDays('2026-10-21', 'America/New_York', new Date('2026-10-21T03:00:00Z')), 1);
  assert.equal(countdownDays('2026-10-21', 'Asia/Tokyo', new Date('2026-10-20T15:00:00Z')), 0);
});

test('stays a whole number of days across a daylight saving change', () => {
  // Rome leaves summer time on 2026-10-25 at 03:00; 00:30 that night is the 25th.
  assert.equal(countdownDays('2026-10-26', 'Europe/Rome', new Date('2026-10-24T22:30:00Z')), 1);
  assert.equal(countdownDays('2026-10-26', 'Europe/Rome', new Date('2026-10-25T23:30:00Z')), 0);
  // And enters it on 2026-03-29 at 02:00.
  assert.equal(countdownDays('2026-03-30', 'Europe/Rome', new Date('2026-03-28T23:30:00Z')), 1);
});
