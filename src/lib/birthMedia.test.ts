import assert from 'node:assert/strict';
import { test } from 'node:test';
import { birthMediaUrl } from './birthMedia.ts';
import { mediaKeySchema } from './siteMedia.ts';

const KEY = 'customer-data/owner/site/0b9f3c1e-2a4d-4c5e-8f60-71829304a5b6';
const OTHER_KEY = 'customer-data/owner/site/1c0a4d2f-3b5e-4d6f-9071-829304a5b6c7';

test('Preview and development media use a version-specific path on the page origin', () => {
  const media = { key: mediaKeySchema.parse(KEY), url: 'https://media.example.com/video' };
  for (const env of ['preview', 'development'] as const) {
    assert.equal(
      birthMediaUrl('leo', 'video', media, env),
      `/api/sites/leo/birth-media/video?key=${encodeURIComponent(KEY)}`
    );
  }
  for (const env of ['production', 'staging'] as const) {
    assert.equal(birthMediaUrl('leo', 'video', media, env), media.url);
  }
  assert.notEqual(
    birthMediaUrl('leo', 'video', media, 'preview'),
    birthMediaUrl('leo', 'video', { ...media, key: mediaKeySchema.parse(OTHER_KEY) }, 'preview')
  );
});
