import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freeHold, isHeld, type JumpEvent, type JumpHold, jumpHold, jumpMoves } from './sectionNavHold.ts';

function run(events: JumpEvent[], from: JumpHold = freeHold): JumpHold {
  return events.reduce(jumpHold, from);
}

test('nothing holds the mark until a link is clicked', () => {
  assert.equal(isHeld(freeHold), false);
  assert.equal(isHeld(run(['scroll', 'scrollend', 'settle'])), false);
});

test('a glide holds the mark through its scrolls and scrollend, and the next scroll lets go', () => {
  const landed = run(['click', 'scroll', 'settle', 'scroll', 'scroll', 'scrollend']);
  assert.equal(isHeld(landed), true);
  assert.equal(isHeld(jumpHold(landed, 'scroll')), false);
});

test('a click on a section already in place lets go when it settles', () => {
  const clicked = run(['click']);
  assert.equal(isHeld(clicked), true);
  assert.equal(isHeld(jumpHold(clicked, 'settle')), false);
  // The first manual scroll afterwards moves the mark again.
  assert.equal(isHeld(run(['click', 'settle', 'scroll'])), false);
});

test('settle leaves a glide that has started alone', () => {
  assert.equal(isHeld(run(['click', 'scroll', 'settle'])), true);
});

test('an instant jump, with no glide, lands like a glide', () => {
  const landed = run(['click', 'scroll', 'scrollend', 'settle']);
  assert.deepEqual(landed, { phase: 'landed' });
  assert.equal(isHeld(jumpHold(landed, 'scroll')), false);
});

test('a click during a glide starts a new jump', () => {
  assert.deepEqual(run(['click', 'scroll', 'click']), { phase: 'jumping', moved: false });
  assert.deepEqual(run(['click', 'scroll', 'scrollend', 'click']), { phase: 'jumping', moved: false });
});

test('scrollend without a jump changes nothing', () => {
  assert.equal(run(['scrollend']), freeHold);
});

test('a jump moves the page unless its section is already in place', () => {
  assert.equal(jumpMoves({ scrollY: 40, offset: 3000, maxScroll: 5000 }), true);
  assert.equal(jumpMoves({ scrollY: 400, offset: -300, maxScroll: 5000 }), true);
  assert.equal(jumpMoves({ scrollY: 400, offset: 0.4, maxScroll: 5000 }), false);
});

test('a jump past the end of the page moves only as far as the page scrolls', () => {
  // The last section never reaches the top: at the bottom already, nothing moves.
  assert.equal(jumpMoves({ scrollY: 5000, offset: 600, maxScroll: 5000 }), false);
  assert.equal(jumpMoves({ scrollY: 4800, offset: 600, maxScroll: 5000 }), true);
  // At the top, a section above the fold's edge moves nothing either.
  assert.equal(jumpMoves({ scrollY: 0, offset: -20, maxScroll: 5000 }), false);
});
