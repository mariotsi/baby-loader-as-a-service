import { expect, test } from 'vitest';
import { commentBody, previewUrl } from './preview-comment.mjs';

test('the Preview link follows from the branch name', () => {
  expect(previewUrl('feat/Push', 'me.workers.dev')).toBe('https://feat-push-loading-baby-staging.me.workers.dev');
});

test('a ready comment shows the Cloudflare project, preview link, and commit', () => {
  const body = commentBody('ready', 'https://x.workers.dev', '0123456789abcdef');
  expect(body.startsWith('<!-- loading-baby-preview -->')).toBeTruthy();
  expect(body).toMatch(/\| Project \| Deployment \| Actions \| Updated \|/);
  expect(body).toMatch(/\[Preview\]\(https:\/\/x\.workers\.dev\)/);
  expect(body).toMatch(/\[Ready\]\(https:\/\/x\.workers\.dev\).*`0123456`/);
  expect(body).not.toMatch(/Cloudflare Access|owner email/i);
});

test('a ready comment links the deployment itself when it is known', () => {
  const body = commentBody('ready', 'https://x.workers.dev', '0123456789abcdef', 'https://abc-x.workers.dev');
  expect(body).toMatch(/\[Ready\]\(https:\/\/abc-x\.workers\.dev\)/);
});

test('a deleted comment drops the link', () => {
  expect(commentBody('deleted', 'https://x.workers.dev', null)).not.toMatch(/x\.workers\.dev/);
});
