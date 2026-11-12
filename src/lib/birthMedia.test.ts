import { expect, test } from 'vitest';
import { birthMediaUrl, isMediaUrl } from './birthMedia.ts';
import { mediaKeySchema } from './siteMedia.ts';

const KEY = 'customer-data/owner/site/0b9f3c1e-2a4d-4c5e-8f60-71829304a5b6';
const OTHER_KEY = 'customer-data/owner/site/1c0a4d2f-3b5e-4d6f-9071-829304a5b6c7';

test('Preview and development media use a version-specific path on the page origin', () => {
  const media = { key: mediaKeySchema.parse(KEY), url: 'https://media.example.com/video' };
  for (const env of ['preview', 'development'] as const) {
    expect(birthMediaUrl('leo', 'video', media, env)).toBe(
      `/api/sites/leo/birth-media/video?key=${encodeURIComponent(KEY)}`
    );
  }
  for (const env of ['production', 'staging'] as const) {
    expect(birthMediaUrl('leo', 'video', media, env)).toBe(media.url);
  }
  expect(birthMediaUrl('leo', 'video', media, 'preview')).not.toBe(
    birthMediaUrl('leo', 'video', { ...media, key: mediaKeySchema.parse(OTHER_KEY) }, 'preview')
  );
});

test('a MediaUrl is an https URL, a path on the page origin or a blob: URL', () => {
  for (const url of [
    'https://media.example.com/photo',
    '/website-assets/born-placeholder-v1.png',
    'blob:https://x.test/1',
  ]) {
    expect(isMediaUrl(url), url).toBe(true);
  }
  for (const url of ['http://media.example.com/photo', '//evil.test/photo', 'javascript:alert(1)', 'photo.png', '']) {
    expect(isMediaUrl(url), url).toBe(false);
  }
});
