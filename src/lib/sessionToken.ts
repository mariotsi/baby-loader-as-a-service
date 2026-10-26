import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The session cookie's value: `<userId>.<expiresAt>[.change].<signature>`,
 * the HMAC signature covering everything before it. `change` marks a session
 * whose User must choose a new password before anything else.
 *
 * Imports only Node built-ins and takes the secret as an argument, so the E2E
 * suite signs sessions exactly as the app does.
 */

export interface Session {
  userId: string;
  passwordChangePending: boolean;
}

const PASSWORD_CHANGE_PENDING = 'change';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signSessionToken(session: Session, expiresAt: number, secret: string): string {
  const parts = [session.userId, String(expiresAt)];
  if (session.passwordChangePending) {
    parts.push(PASSWORD_CHANGE_PENDING);
  }
  const payload = parts.join('.');
  return `${payload}.${sign(payload, secret)}`;
}

/** The session a token carries, or null if the token is missing, forged or expired. */
export function readSessionToken(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) {
    return null;
  }
  const parts = token.split('.');
  const signature = parts.pop();
  const [userId, expiresAt, marker] = parts;
  const pending = parts.length === 3 && marker === PASSWORD_CHANGE_PENDING;
  if (!userId || !expiresAt || !signature || (parts.length !== 2 && !pending)) {
    return null;
  }
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(sign(parts.join('.'), secret), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  if (Number(expiresAt) <= now) {
    return null;
  }
  return { userId, passwordChangePending: pending };
}
