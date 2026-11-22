import { expect, test } from 'vitest';
import { readSessionToken, signSessionToken } from './sessionToken.ts';

const EXPIRES = Date.parse('2026-12-01T00:00:00Z');
const SECRET = 'session-secret-for-tests';

for (const passwordChangePending of [false, true]) {
  const session = { userId: 'user', passwordChangePending };
  const token = signSessionToken(session, EXPIRES, SECRET);
  const kind = passwordChangePending ? 'a session with a password change pending' : 'a session';

  test(`${kind} reads until the moment it expires, and not from then on`, () => {
    expect(readSessionToken(token, SECRET, EXPIRES - 1)).toStrictEqual(session);
    expect(readSessionToken(token, SECRET, EXPIRES)).toBe(null);
    expect(readSessionToken(token, SECRET, EXPIRES + 1)).toBe(null);
  });

  test(`${kind} cannot have its expiry moved`, () => {
    const moved = token.replace(String(EXPIRES), String(EXPIRES + 60_000));
    expect(readSessionToken(moved, SECRET, EXPIRES)).toBe(null);
  });
}
