/**
 * Where a run points, from the environment:
 * - E2E_BASE_URL: the deployment under test. Unset, Playwright builds the
 *   Worker and runs it on LOCAL_BASE_URL with a local D1.
 * - E2E_PASSWORD: password of the fixture Owners.
 * - CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID: let the data script
 *   write to a deployed environment's D1 database.
 * - VERCEL_AUTOMATION_BYPASS_SECRET: lets requests through Vercel's
 *   Deployment Protection on preview deployments.
 * The global setup picks the database from the deployment's environment.
 */

export const LOCAL_PORT = 3100;
export const LOCAL_BASE_URL = `http://localhost:${LOCAL_PORT}`;
/** State of the local Worker's D1, apart from the one `npm run dev` uses. */
export const LOCAL_D1_PERSIST_TO = '.wrangler/e2e';
const LOCAL_E2E_PASSWORD = 'local-e2e-password';
/** SESSION_SECRET of the app Playwright starts locally. */
export const LOCAL_SESSION_SECRET = 'local-e2e-session-secret';

export const BASE_URL = process.env.E2E_BASE_URL || LOCAL_BASE_URL;
export const STARTS_LOCAL_SERVER = !process.env.E2E_BASE_URL;

export function e2ePassword(): string {
  const password = process.env.E2E_PASSWORD || (STARTS_LOCAL_SERVER ? LOCAL_E2E_PASSWORD : '');
  if (!password) {
    throw new Error('Set E2E_PASSWORD, the fixture Owners password of the deployment under test');
  }
  return password;
}

/**
 * The secret the deployment under test signs sessions with, known only for
 * the local server: tests that sign a session themselves run there alone.
 */
export function sessionSecret(): string | undefined {
  return STARTS_LOCAL_SERVER ? LOCAL_SESSION_SECRET : undefined;
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
