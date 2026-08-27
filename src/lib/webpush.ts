import webpush from 'web-push';

const VAPID_EMAIL = process.env.VAPID_EMAIL;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let vapidReady = false;

/**
 * Configures web-push lazily: a missing env var must not crash module
 * evaluation, which would turn every request touching this module into an
 * opaque 500.
 */
export function ensureVapid(): boolean {
  if (vapidReady) {
    return true;
  }
  if (!VAPID_EMAIL || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

export { webpush };
