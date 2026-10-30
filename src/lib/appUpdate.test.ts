import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNewDeploy, PULL_TO_REFRESH_MAX, PULL_TO_REFRESH_THRESHOLD, pullOffset, pullReloads } from './appUpdate.ts';

test('The pull indicator follows the finger at half its speed, never up and never past its stop', () => {
  assert.equal(pullOffset(-40), 0);
  assert.equal(pullOffset(0), 0);
  assert.equal(pullOffset(50), 25);
  assert.equal(pullOffset(1000), PULL_TO_REFRESH_MAX);
});

test('Only a pull that brings the indicator to the threshold reloads the page', () => {
  assert.equal(pullReloads(pullOffset(PULL_TO_REFRESH_THRESHOLD * 2 - 1)), false);
  assert.equal(pullReloads(pullOffset(PULL_TO_REFRESH_THRESHOLD * 2)), true);
  assert.equal(pullReloads(pullOffset(1000)), true);
});

test('A page reloads only when the live deploy is known to be another commit', () => {
  assert.equal(isNewDeploy('abc', 'def'), true);
  assert.equal(isNewDeploy('abc', 'abc'), false);
  assert.equal(isNewDeploy(null, 'def'), false);
  assert.equal(isNewDeploy('abc', null), false);
  assert.equal(isNewDeploy('abc', undefined), false);
});
