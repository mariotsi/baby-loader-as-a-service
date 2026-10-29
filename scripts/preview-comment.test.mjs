import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commentBody, previewUrl } from './preview-comment.mjs';

test('the Preview link follows from the branch name', () => {
  assert.equal(previewUrl('feat/Push', 'me.workers.dev'), 'https://feat-push-loading-baby-staging.me.workers.dev');
});

test('a ready comment shows the Cloudflare project, preview link, and commit', () => {
  const body = commentBody('ready', 'https://x.workers.dev', '0123456789abcdef');
  assert.ok(body.startsWith('<!-- loading-baby-preview -->'));
  assert.match(body, /\| Project \| Deployment \| Actions \| Updated \|/);
  assert.match(body, /\[Preview\]\(https:\/\/x\.workers\.dev\)/);
  assert.match(body, /\[Ready\]\(https:\/\/x\.workers\.dev\).*`0123456`/);
  assert.doesNotMatch(body, /Cloudflare Access|owner email/i);
});

test('a ready comment links the deployment itself when it is known', () => {
  const body = commentBody('ready', 'https://x.workers.dev', '0123456789abcdef', 'https://abc-x.workers.dev');
  assert.match(body, /\[Ready\]\(https:\/\/abc-x\.workers\.dev\)/);
});

test('a deleted comment drops the link', () => {
  assert.doesNotMatch(commentBody('deleted', 'https://x.workers.dev', null), /x\.workers\.dev/);
});
