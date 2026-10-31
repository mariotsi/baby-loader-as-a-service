#!/usr/bin/env node
// Takes the pictures of the home page's deck from a running app: one screen of
// each card's Public page, at a phone's size, into public/home-deck/.
//
//   npm run seed && npm run dev
//   npm run deck [base URL]    http://localhost:3000 by default

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { HOME_DECK_CARDS, homeDeckImage } from '../src/lib/homeDeck.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 390, height: 640 };
const QUALITY = 0.82;
/** Environment ribbon and Next's dev indicator: neither is part of a Public page. */
const HIDDEN = '.env-ribbon, nextjs-portal { display: none; }';

/** The browser encodes the WebP, so the script needs no image library. */
function toWebp({ png, quality }) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/webp', quality).split(',')[1]);
    };
    image.onerror = reject;
    image.src = `data:image/png;base64,${png}`;
  });
}

async function capture(page, base, card) {
  const response = await page.goto(new URL(`/sites/${card.slug}`, base).href, { waitUntil: 'networkidle' });
  if (!response?.ok()) {
    throw new Error(`${card.slug} answered ${response?.status()}: run \`npm run seed\` first`);
  }
  await page.addStyleTag({ content: HIDDEN });
  await page.evaluate(() => document.fonts.ready);
  if (card.atMilestones) {
    await page.locator('section[class*="milestones"]').evaluate((section) => {
      window.scrollTo({ top: section.getBoundingClientRect().top + window.scrollY - 24, behavior: 'instant' });
    });
  }
  await page.waitForLoadState('networkidle');
  const png = await page.screenshot({ type: 'png' });
  const webp = await page.evaluate(toWebp, { png: png.toString('base64'), quality: QUALITY });
  return Buffer.from(webp, 'base64');
}

async function main() {
  const base = process.argv[2] ?? 'http://localhost:3000';
  const out = join(ROOT, 'public/home-deck');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    // A headless browser denies notifications, which swaps the Public page's button for help on enabling them.
    await context.addInitScript(() => Object.defineProperty(Notification, 'permission', { get: () => 'default' }));
    // Locally the picture's URL points at media storage, which has no such file.
    await context.route('**/born-placeholder-v1.png', (route) =>
      route.fulfill({ path: join(ROOT, 'public/website-assets/born-placeholder-v1.png') })
    );
    const page = await context.newPage();
    for (const card of HOME_DECK_CARDS) {
      const webp = await capture(page, base, card);
      writeFileSync(join(ROOT, 'public', homeDeckImage(card)), webp);
      console.log(`${card.slug}: ${Math.round(webp.length / 1024)} KB`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
