import assert from 'node:assert/strict';
import { test } from 'node:test';
import { birthMediaUrl } from './birthMedia.ts';

test('Staging and Preview media use a version-specific path on the page origin', () => {
  const media = { key: 'customer-data/owner/site/video', url: 'https://media.example.com/video' };
  for (const env of ['staging', 'preview'] as const) {
    assert.equal(
      birthMediaUrl('leo', 'video', media, env),
      '/api/sites/leo/birth-media/video?key=customer-data%2Fowner%2Fsite%2Fvideo'
    );
  }
  for (const env of ['production', 'development'] as const) {
    assert.equal(birthMediaUrl('leo', 'video', media, env), media.url);
  }
  assert.notEqual(
    birthMediaUrl('leo', 'video', media, 'preview'),
    birthMediaUrl('leo', 'video', { ...media, key: 'customer-data/owner/site/replacement' }, 'preview')
  );
});
