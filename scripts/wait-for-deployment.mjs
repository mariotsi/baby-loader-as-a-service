#!/usr/bin/env node
// Finds where a deployment serves a given commit and prints the URL to test
// it on, as a GitHub Actions environment line: E2E_BASE_URL=https://<rootDomain>.
//
//   DEPLOYMENT_URL=https://... COMMIT=<sha> node scripts/wait-for-deployment.mjs >> "$GITHUB_ENV"
//
// DEPLOYMENT_URL is where the deploy put the Worker. The Dashboard builds
// Addresses on rootDomain, so tests run there, once that host serves the
// commit too. CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET get the requests
// through Cloudflare Access.

const TIMEOUT_MS = 15 * 60 * 1000;
const INTERVAL_MS = 10 * 1000;

const { CF_ACCESS_CLIENT_ID: accessId, CF_ACCESS_CLIENT_SECRET: accessSecret } = process.env;
const headers =
  accessId && accessSecret ? { 'CF-Access-Client-Id': accessId, 'CF-Access-Client-Secret': accessSecret } : {};

/** The deployment's /api/version, or why it isn't there: an HTTP status, a redirect or a network error. */
async function version(baseUrl) {
  try {
    const res = await fetch(new URL('/api/version', baseUrl), { headers, redirect: 'manual' });
    if (res.ok) {
      return { version: await res.json() };
    }
    const location = res.headers.get('location');
    return { problem: `HTTP ${res.status}${location ? ` to ${new URL(location, baseUrl).origin}` : ''}` };
  } catch (err) {
    return { problem: err.message };
  }
}

async function waitForCommit(baseUrl, commit, deadline) {
  for (;;) {
    const { version: v, problem } = await version(baseUrl);
    if (v?.commit === commit) {
      return v;
    }
    const serves = v ? v.commit : `nothing (${problem})`;
    if (Date.now() > deadline) {
      throw new Error(`${baseUrl} still serves ${serves}, not ${commit}`);
    }
    console.error(`${baseUrl} serves ${serves}; waiting for ${commit}`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

async function main() {
  const { DEPLOYMENT_URL: deploymentUrl, COMMIT: commit } = process.env;
  if (!deploymentUrl || !commit) {
    throw new Error('Set DEPLOYMENT_URL and COMMIT');
  }
  const deadline = Date.now() + TIMEOUT_MS;
  const v = await waitForCommit(deploymentUrl, commit, deadline);
  const baseUrl = `https://${v.rootDomain}`;
  if (new URL(baseUrl).origin !== new URL(deploymentUrl).origin) {
    await waitForCommit(baseUrl, commit, deadline);
  }
  console.error(`${baseUrl} serves ${commit} (${v.env})`);
  console.log(`E2E_BASE_URL=${baseUrl}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
