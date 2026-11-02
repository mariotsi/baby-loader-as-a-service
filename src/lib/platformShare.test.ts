import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { LANGS } from './i18n.ts';
import {
  PLATFORM_SHARE_IMAGE_SIZE,
  PLATFORM_SHARE_PAGES,
  platformShareImage,
  platformShareImagePath,
  platformShareMeta,
} from './platformShare.ts';

for (const page of PLATFORM_SHARE_PAGES) {
  for (const lang of LANGS) {
    test(`the ${page} share image exists in ${lang}, at the size the tags announce`, () => {
      const png = readFileSync(join('public', platformShareImagePath(page, lang)));
      assert.deepEqual({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, PLATFORM_SHARE_IMAGE_SIZE);
    });

    test(`the ${page} preview in ${lang} shows its own language's image on both networks`, () => {
      const image = platformShareImage(page, lang);
      const { openGraph, twitter } = platformShareMeta(page, lang);
      assert.equal(image.url, `/og/${page}-${lang}.png`);
      assert.deepEqual(openGraph?.images, [image]);
      assert.deepEqual(twitter?.images, [image]);
    });
  }
}

test('each language and page has its own alt text', () => {
  const alts = PLATFORM_SHARE_PAGES.flatMap((page) => LANGS.map((lang) => platformShareImage(page, lang).alt));
  assert.equal(new Set(alts).size, alts.length);
});
