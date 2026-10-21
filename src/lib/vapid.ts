/** Uncompressed P-256 point: 1 prefix byte + 32 bytes X + 32 bytes Y. */
const VAPID_KEY_BYTES = 65;
const UNCOMPRESSED_POINT_PREFIX = 0x04;

export class VapidKeyError extends Error {}

/**
 * Decodes a base64url VAPID public key into the ArrayBuffer expected by
 * `PushManager.subscribe`.
 *
 * Validates eagerly: the browser otherwise reports any malformed value as a
 * generic "The provided applicationServerKey is not valid", which hides the
 * common cause (env var missing, or dev server not restarted after adding it).
 */
export function decodeVapidKey(raw: string | undefined): ArrayBuffer {
  // Tolerate values pasted with surrounding quotes or trailing newlines.
  const normalized = (raw ?? '').trim().replace(/^["']|["']$/g, '').trim();

  if (!normalized) {
    throw new VapidKeyError(
      'Missing VAPID public key. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local and restart the dev server.'
    );
  }

  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = (normalized + padding).replace(/-/g, '+').replace(/_/g, '/');

  let binary: string;
  try {
    binary = atob(base64);
  } catch (err) {
    throw new VapidKeyError(
      'Invalid VAPID public key: not a base64url string. Regenerate it with `npm run generate-vapid`.',
      { cause: err }
    );
  }

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  if (bytes.length !== VAPID_KEY_BYTES || bytes[0] !== UNCOMPRESSED_POINT_PREFIX) {
    throw new VapidKeyError(
      `Invalid VAPID public key: expected ${VAPID_KEY_BYTES} bytes, got ${bytes.length}. ` +
        'Make sure you copied the public key (not the private one) and regenerate it with `npm run generate-vapid`.'
    );
  }

  return bytes.buffer as ArrayBuffer;
}
