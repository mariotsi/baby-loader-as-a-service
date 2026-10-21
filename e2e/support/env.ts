/**
 * Where a run points, from the environment:
 * - E2E_BASE_URL: the deployment under test. Unset, Playwright builds and
 *   starts the app on LOCAL_BASE_URL against the local MongoDB.
 * - E2E_MONGODB_URI: where the run's test data goes; the local MongoDB when
 *   unset and the deployment is a local one.
 * - E2E_PASSWORD: password of the fixture Owners.
 * - VERCEL_AUTOMATION_BYPASS_SECRET: lets requests through Vercel's
 *   Deployment Protection on preview deployments.
 */

export const LOCAL_PORT = 3100;
export const LOCAL_BASE_URL = `http://localhost:${LOCAL_PORT}`;
export const LOCAL_MONGODB_URI = 'mongodb://localhost:27017';
/** Database of the app Playwright starts locally, apart from the one `npm run dev` uses. */
export const LOCAL_E2E_DB_NAME = 'waitingpages-e2e';
const LOCAL_E2E_PASSWORD = 'local-e2e-password';

export const BASE_URL = process.env.E2E_BASE_URL || LOCAL_BASE_URL;
export const STARTS_LOCAL_SERVER = !process.env.E2E_BASE_URL;

export function e2ePassword(): string {
  const password = process.env.E2E_PASSWORD || (STARTS_LOCAL_SERVER ? LOCAL_E2E_PASSWORD : '');
  if (!password) {
    throw new Error('Set E2E_PASSWORD, the fixture Owners password of the deployment under test');
  }
  return password;
}

/** Sent only to the deployment under test, never to third parties such as Google Fonts. */
export function bypassHeaders(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { 'x-vercel-protection-bypass': secret } : {};
}

export function ownerStatePath(owner: 'a' | 'b'): string {
  return `e2e/.auth/owner-${owner}.json`;
}

/** Set by the global setup for every worker. */
export function runId(): string {
  const id = process.env.E2E_RUN_ID;
  if (!id) {
    throw new Error('E2E_RUN_ID is unset: the global setup did not run');
  }
  return id;
}
