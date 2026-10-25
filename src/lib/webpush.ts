import webpush from 'web-push';
import { vapidEnv } from './env.ts';
import type { PushService } from './notificationDelivery.ts';

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
  const vapid = vapidEnv();
  if (!vapid) {
    return false;
  }
  webpush.setVapidDetails(vapid.email, vapid.publicKey, vapid.privateKey);
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
