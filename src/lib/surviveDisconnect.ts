import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Keeps `work` running for up to 30 seconds after the client disconnects,
 * when a Worker otherwise cancels what the request was awaiting (ADR-0010).
 * Await what this returns to answer with the result.
 */
export function surviveDisconnect<T>(work: Promise<T>): Promise<T> {
  getCloudflareContext().ctx.waitUntil(work);
  return work;
}
