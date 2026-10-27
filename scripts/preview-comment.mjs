#!/usr/bin/env node
// Keeps one comment with a branch's Preview link on each of its open pull
// requests, the way Vercel's bot did: written once, then edited in place.
//
//   node scripts/preview-comment.mjs ready <branch> <commit> [deployment url]   the Preview serves <commit>
//   node scripts/preview-comment.mjs opened <branch>           a new pull request, for a branch that may already have one
//   node scripts/preview-comment.mjs deleted <branch>          the Preview and its database are gone
//
// Needs GITHUB_TOKEN (pull requests and issues: write) and GITHUB_REPOSITORY.
// The link follows from the branch name (previewName in src/lib/dbName.ts)
// and WORKERS_DEV, the account's workers.dev subdomain.

import { previewName } from '../src/lib/dbName.ts';

const MARKER = '<!-- loading-baby-preview -->';
const API = 'https://api.github.com';

export function previewUrl(branch, workersDev) {
  return `https://${previewName(branch)}-loading-baby-staging.${workersDev}`;
}

/**
 * The comment's body; `commit` is null when the run that writes it didn't
 * deploy, and `deploymentUrl` is that one deployment's own address.
 */
export function commentBody(state, url, commit, deploymentUrl = null) {
  const lines = [MARKER, '### Cloudflare Preview', ''];
  if (state === 'deleted') {
    lines.push('The Preview and its D1 database were removed when the branch closed.');
  } else {
    lines.push(`**Preview:** ${url}`);
    lines.push(`**Sites:** \`${url}/sites/<slug>\``);
    if (deploymentUrl) {
      lines.push(`**This deployment:** ${deploymentUrl}`);
    }
    lines.push('');
    lines.push(
      commit
        ? `Serves \`${commit.slice(0, 7)}\`, deployed ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}.`
        : 'Deployed by the latest push to the branch; the next push updates this comment.'
    );
    lines.push('Behind Cloudflare Access: sign in with the owner email.');
  }
  return lines.join('\n');
}

async function github(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${init.method ?? 'GET'} ${path} answered ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Edits the pull request's Preview comment, or writes one when `create` is set. */
async function upsert(repo, number, body, create) {
  const comments = await github(`/repos/${repo}/issues/${number}/comments?per_page=100`);
  const existing = comments.find((c) => c.user?.type === 'Bot' && c.body?.startsWith(MARKER));
  if (existing) {
    await github(`/repos/${repo}/issues/comments/${existing.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
  } else if (create) {
    await github(`/repos/${repo}/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  }
}

async function main() {
  const [state, branch, commit, deploymentUrl] = process.argv.slice(2);
  const { GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token, WORKERS_DEV: workersDev } = process.env;
  if (!['ready', 'opened', 'deleted'].includes(state) || !branch || (state === 'ready' && !commit)) {
    throw new Error(
      'Usage: preview-comment.mjs ready <branch> <commit> [deployment url] | opened <branch> | deleted <branch>'
    );
  }
  if (!repo || !token || !workersDev) {
    throw new Error('Set GITHUB_REPOSITORY, GITHUB_TOKEN and WORKERS_DEV');
  }
  const owner = repo.split('/')[0];
  // A closed pull request still gets its "deleted" note, on the comment it
  // already has.
  const prState = state === 'deleted' ? 'all' : 'open';
  const pulls = await github(
    `/repos/${repo}/pulls?state=${prState}&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=100`
  );
  const body = commentBody(
    state,
    previewUrl(branch, workersDev),
    state === 'ready' ? commit : null,
    state === 'ready' ? deploymentUrl || null : null
  );
  for (const pr of pulls) {
    await upsert(repo, pr.number, body, state !== 'deleted');
    console.log(`Preview comment on #${pr.number}: ${state}`);
  }
  if (pulls.length === 0) {
    console.log(`${branch} has no pull request to comment on.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
