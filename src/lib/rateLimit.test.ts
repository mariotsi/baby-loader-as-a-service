import { afterEach, beforeEach, expect, test, vi } from 'vitest';

let rateLimit: typeof import('./rateLimit.ts').rateLimit;

beforeEach(async () => {
  // The buckets live as long as the module, so each test loads its own.
  vi.resetModules();
  ({ rateLimit } = await import('./rateLimit.ts'));
  vi.useFakeTimers({ toFake: ['Date'], now: 1_000_000 });
});

afterEach(() => vi.useRealTimers());

test('a key is let through up to its limit, and no further', () => {
  expect([1, 2, 3, 4].map(() => rateLimit('a', 3, 1000))).toStrictEqual([true, true, true, false]);
});

test('each key has its own count', () => {
  expect(rateLimit('a', 1, 1000)).toBe(true);
  expect(rateLimit('a', 1, 1000)).toBe(false);
  expect(rateLimit('b', 1, 1000)).toBe(true);
});

test('the count starts over once the window has passed, however many were refused in it', () => {
  expect(rateLimit('a', 1, 1000)).toBe(true);
  vi.setSystemTime(1_000_900);
  expect(rateLimit('a', 1, 1000)).toBe(false);
  vi.setSystemTime(1_001_000);
  expect(rateLimit('a', 1, 1000)).toBe(false);
  vi.setSystemTime(1_001_001);
  expect(rateLimit('a', 1, 1000)).toBe(true);
});

test('clearing expired keys out of a full map keeps the ones still counting', () => {
  expect(rateLimit('long', 1, 60_000)).toBe(true);
  for (let i = 0; i < 5000; i++) {
    rateLimit(`short-${i}`, 1, 10);
  }
  vi.setSystemTime(1_000_100);
  expect(rateLimit('new', 1, 1000)).toBe(true);
  expect(rateLimit('long', 1, 60_000)).toBe(false);
});
