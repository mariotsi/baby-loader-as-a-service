import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
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
      expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toStrictEqual(PLATFORM_SHARE_IMAGE_SIZE);
    });

    test(`the ${page} preview in ${lang} shows its own language's image on both networks`, () => {
      const image = platformShareImage(page, lang);
      const { openGraph, twitter } = platformShareMeta(page, lang);
      expect(image.url).toBe(`/og/${page}-${lang}.png`);
      expect(openGraph?.images).toStrictEqual([image]);
      expect(twitter?.images).toStrictEqual([image]);
    });
  }
}

test('each language and page has its own alt text', () => {
  const alts = PLATFORM_SHARE_PAGES.flatMap((page) => LANGS.map((lang) => platformShareImage(page, lang).alt));
  expect(new Set(alts).size).toBe(alts.length);
});
