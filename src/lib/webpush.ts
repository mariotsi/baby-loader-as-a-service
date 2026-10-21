import webpush from 'web-push';
import type { PushService } from './notificationDelivery.ts';

const VAPID_EMAIL = process.env.VAPID_EMAIL;
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let vapidReady = false;

/**
 * Configures web-push lazily: a missing env var must not crash module
 * evaluation, which would turn every request touching this module into an
 * opaque 500.
 */
function ensureVapid(): boolean {
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

/**
 * The production push service for Notification delivery, or null when the
 * VAPID keys are missing. 404 and 410 mean the push service forgot the
 * endpoint for good; any other error may pass.
 */
export function webPushService(): PushService | null {
  if (!ensureVapid()) {
    return null;
  }
  return {
    async send(target, payload) {
      try {
        await webpush.sendNotification(target, payload);
        return 'delivered';
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number } | null)?.statusCode;
        return statusCode === 404 || statusCode === 410 ? 'gone' : 'failed';
      }
    },
  };
}
