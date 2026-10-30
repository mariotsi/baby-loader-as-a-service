/**
 * How an open Public page stays current. Its content is rendered once per
 * request, Countdown included, so a page left open shows the day it loaded.
 * Saved to an iPhone's home screen it is worse: iOS runs it full screen,
 * without an address bar or Safari's pull-to-refresh, and resumes the page it
 * kept in memory instead of loading it again, so it shows the content and
 * the code it first loaded until iOS drops it.
 */

/**
 * How far, in CSS pixels, the pull indicator must come down for the page to
 * reload when the finger lifts. It follows the finger at half its speed, so
 * that is a pull of twice this.
 */
export const PULL_TO_REFRESH_THRESHOLD = 64;

/** How far the pull indicator comes down at most. */
export const PULL_TO_REFRESH_MAX = 96;

/** How often a page in view checks for new content and a newer deploy. */
export const PERIODIC_CHECK_INTERVAL_MS = 5 * 60_000;

/** The least time between two checks for a newer deploy, so quick app switches cost nothing. */
export const RESUME_CHECK_INTERVAL_MS = 30_000;

/** How far the indicator has moved for a finger that has moved `distance` down. */
export function pullOffset(distance: number): number {
  return distance <= 0 ? 0 : Math.min(distance / 2, PULL_TO_REFRESH_MAX);
}

/** Whether a pull of `offset` (see pullOffset) reloads the page when the finger lifts. */
export function pullReloads(offset: number): boolean {
  return offset >= PULL_TO_REFRESH_THRESHOLD;
}

/**
 * Whether the deploy now live (as /api/version says) is a different build
 * from the one that rendered this page, so the page's code is out of date.
 * Without a commit on either side, as in development, nothing is known.
 */
export function isNewDeploy(rendered: string | null, live: string | null | undefined): boolean {
  return Boolean(rendered && live && rendered !== live);
}
