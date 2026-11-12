import { expect, test } from 'vitest';
import {
  isPreviewDbName,
  PREVIEW_POOL,
  PRODUCTION_DB_NAME,
  previewName,
  STAGING_DB_NAME,
  testDataPolicy,
} from './dbName.ts';

const POOL_DB = PREVIEW_POOL[0].name;

test('previewName lowercases the branch and replaces separators', () => {
  expect(previewName('Feat/Staging_Env')).toBe('feat-staging-env');
  expect(previewName('fix--double..dots')).toBe('fix-double-dots');
  expect(previewName('/leading-and-trailing/')).toBe('leading-and-trailing');
});

test('previewName starts with a letter', () => {
  expect(previewName('63-cloudflare')).toBe('b-63-cloudflare');
});

test('previewName keeps its workers.dev label within 63 characters and apart', () => {
  const a = previewName(`feature/${'x'.repeat(80)}-a`);
  const b = previewName(`feature/${'x'.repeat(80)}-b`);
  expect(`${a}-loading-baby-staging`.length <= 63, a).toBeTruthy();
  expect(a).not.toBe(b);
  expect(a).toMatch(/^feature-x+-[0-9a-f]{8}$/);
});

test('previewName rejects a branch with no usable characters', () => {
  expect(() => previewName('///')).toThrow();
});

test('isPreviewDbName accepts only the pool', () => {
  expect(isPreviewDbName(PRODUCTION_DB_NAME)).toBe(false);
  expect(isPreviewDbName(STAGING_DB_NAME)).toBe(false);
  expect(isPreviewDbName(`${PRODUCTION_DB_NAME}-feat-x`)).toBe(false);
  for (const db of PREVIEW_POOL) {
    expect(isPreviewDbName(db.name)).toBe(true);
  }
});

test('the pool never holds production or staging', () => {
  const names = PREVIEW_POOL.map((db) => db.name);
  expect(new Set(names).size).toBe(names.length);
  expect(!names.includes(PRODUCTION_DB_NAME) && !names.includes(STAGING_DB_NAME)).toBeTruthy();
});

test('testDataPolicy never writes test data to production', () => {
  expect(testDataPolicy({ local: false, dbName: PRODUCTION_DB_NAME })).toStrictEqual({ fixtures: false, demo: false });
  expect(testDataPolicy({ local: false, dbName: 'pushnotify' })).toStrictEqual({ fixtures: false, demo: false });
});

test('testDataPolicy keeps demo data off staging', () => {
  expect(testDataPolicy({ local: false, dbName: STAGING_DB_NAME })).toStrictEqual({ fixtures: true, demo: false });
  expect(testDataPolicy({ local: false, dbName: POOL_DB })).toStrictEqual({ fixtures: true, demo: true });
});

test('testDataPolicy allows everything on a local database', () => {
  expect(testDataPolicy({ local: true, dbName: STAGING_DB_NAME })).toStrictEqual({ fixtures: true, demo: true });
});
