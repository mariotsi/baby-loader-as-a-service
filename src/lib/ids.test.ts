import { expect, test } from 'vitest';
import { isNotificationId, isSiteId, isSubscriptionId, isUserId, newSiteId, newUserId } from '../db/ids.ts';

test('a new id passes its guard, and every guard takes the same UUID shape', () => {
  for (const guard of [isUserId, isSiteId, isSubscriptionId, isNotificationId]) {
    expect(guard(newUserId())).toBe(true);
    expect(guard(newSiteId())).toBe(true);
  }
});

test('anything but a version 4 UUID is no id', () => {
  for (const value of [
    undefined,
    42,
    '',
    'preview-emma',
    '00000000-0000-0000-0000-000000000000',
    'B1E7A6D2-1C2B-4F3A-9C4D-5E6F7A8B9C0D',
    `${newUserId()} `,
  ]) {
    expect(isUserId(value), String(value)).toBe(false);
    expect(isSiteId(value), String(value)).toBe(false);
  }
});
