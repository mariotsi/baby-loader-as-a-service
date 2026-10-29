#!/usr/bin/env node
// Keeps one comment with a branch's Preview link on each of its open pull
// requests, updating the same comment for each deployment.
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
const CLOUDFLARE_ACCOUNT_ID = '7163354ec1980b37f6d1622ced676359';
const WORKER_NAME = 'loading-baby-staging';
const WORKER_DASHBOARD_URL = `https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/workers/services/view/${WORKER_NAME}/production`;
const CLOUDFLARE_ICON_URL = 'https://www.cloudflare.com/favicon.ico';

export function previewUrl(branch, workersDev) {
  return `https://${previewName(branch)}-loading-baby-staging.${workersDev}`;
}

/**
 * The comment's body; `commit` is null when the run that writes it didn't
 * deploy, and `deploymentUrl` is that one deployment's own address.
 */
export function commentBody(state, url, commit, deploymentUrl = null) {
  const timestamp = new Date().toISOString();
  const worker = `<a href="${WORKER_DASHBOARD_URL}"><img src="${CLOUDFLARE_ICON_URL}" width="16" height="16" align="middle" alt="Cloudflare" /></a> [${WORKER_NAME}](${WORKER_DASHBOARD_URL})`;
  const deployment =
    state === 'deleted'
      ? 'Removed'
      : `✅ [Ready](${deploymentUrl || url})${commit ? ` · \`${commit.slice(0, 7)}\`` : ''}`;
  const actions = state === 'deleted' ? 'n/a' : `[Preview](${url})`;
  const updated = `<relative-time datetime="${timestamp}">${new Date(timestamp).toUTCString()}</relative-time>`;

  const lines = [
    MARKER,
    'Latest updates on your Cloudflare Workers project. Learn more about [Cloudflare Workers](https://developers.cloudflare.com/workers/).',
    '',
    '| Project | Deployment | Actions | Updated |',
    '| :--- | :--- | :--- | :--- |',
    `| ${worker} | ${deployment} | ${actions} | ${updated} |`,
  ];
  if (state !== 'deleted') {
    lines.push('', '| Site | State | Timing at seed |', '| :--- | :--- | :--- |');
    lines.push(`| [Emma](${url}/sites/demo-emma) | Waiting, Italian/English | Due in 45 days |`);
    lines.push(`| [Leo](${url}/sites/demo-leo) | Born, Italian | Born 4 days ago; 3480 g, 52 cm |`);
    lines.push(`| [Sofia](${url}/sites/demo-sofia) | Waiting, name and sex hidden | Due in 80 days |`);
    lines.push(`| [Nina](${url}/sites/demo-nina) | Waiting | Due in 12 days |`);
    lines.push(`| [Late](${url}/sites/demo-late) | Waiting, Italian/English | Due 7 days ago |`);
    lines.push('', 'Dates are relative to the latest demo seed.');
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
