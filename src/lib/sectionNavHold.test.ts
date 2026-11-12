import { expect, test } from 'vitest';
import { freeHold, isHeld, type JumpEvent, type JumpHold, jumpHold, jumpMoves } from './sectionNavHold.ts';

function run(events: JumpEvent[], from: JumpHold = freeHold): JumpHold {
  return events.reduce(jumpHold, from);
}

test('nothing holds the mark until a link is clicked', () => {
  expect(isHeld(freeHold)).toBe(false);
  expect(isHeld(run(['scroll', 'scrollend', 'settle']))).toBe(false);
});

test('a glide holds the mark through its scrolls and scrollend, and the next scroll lets go', () => {
  const landed = run(['click', 'scroll', 'settle', 'scroll', 'scroll', 'scrollend']);
  expect(isHeld(landed)).toBe(true);
  expect(isHeld(jumpHold(landed, 'scroll'))).toBe(false);
});

test('a click on a section already in place lets go when it settles', () => {
  const clicked = run(['click']);
  expect(isHeld(clicked)).toBe(true);
  expect(isHeld(jumpHold(clicked, 'settle'))).toBe(false);
  // The first manual scroll afterwards moves the mark again.
  expect(isHeld(run(['click', 'settle', 'scroll']))).toBe(false);
});

test('settle leaves a glide that has started alone', () => {
  expect(isHeld(run(['click', 'scroll', 'settle']))).toBe(true);
});

test('an instant jump, with no glide, lands like a glide', () => {
  const landed = run(['click', 'scroll', 'scrollend', 'settle']);
  expect(landed).toStrictEqual({ phase: 'landed' });
  expect(isHeld(jumpHold(landed, 'scroll'))).toBe(false);
});

test('a click during a glide starts a new jump', () => {
  expect(run(['click', 'scroll', 'click'])).toStrictEqual({ phase: 'jumping', moved: false });
  expect(run(['click', 'scroll', 'scrollend', 'click'])).toStrictEqual({ phase: 'jumping', moved: false });
});

test('scrollend without a jump changes nothing', () => {
  expect(run(['scrollend'])).toBe(freeHold);
});

test('a jump moves the page unless its section is already in place', () => {
  expect(jumpMoves({ scrollY: 40, offset: 3000, maxScroll: 5000 })).toBe(true);
  expect(jumpMoves({ scrollY: 400, offset: -300, maxScroll: 5000 })).toBe(true);
  expect(jumpMoves({ scrollY: 400, offset: 0.4, maxScroll: 5000 })).toBe(false);
});

test('a jump past the end of the page moves only as far as the page scrolls', () => {
  // The last section never reaches the top: at the bottom already, nothing moves.
  expect(jumpMoves({ scrollY: 5000, offset: 600, maxScroll: 5000 })).toBe(false);
  expect(jumpMoves({ scrollY: 4800, offset: 600, maxScroll: 5000 })).toBe(true);
  // At the top, a section above the fold's edge moves nothing either.
  expect(jumpMoves({ scrollY: 0, offset: -20, maxScroll: 5000 })).toBe(false);
});
