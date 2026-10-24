#!/usr/bin/env node
// Builds the brand kit in brand/ from code, and refreshes the copies the app
// serves. Run with `npm run brand` after changing the mark, the colors or the
// copy below; never edit the files in brand/ by hand.
//
//   brand/Logo     4 marks and 12 lockups, as SVG (text as outlines), PNG and JPG
//   brand/Favicon  favicon.ico, icon.svg, PNG favicons, app icons, push badge
//   brand/Social   Open Graph images, marketing and Dashboard, English and Italian
//
// The mark is the Sleepy spinner, the same drawing as LogoMark in
// src/components/ui/Logo.tsx: a change to one goes in the other.

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import opentype from 'opentype.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'brand');
const FONT_CACHE = join(ROOT, 'node_modules/.cache/brand-kit');

/** Where the app serves kit files from: the destination, then the kit file it copies. */
const APP_COPIES = [
  ['src/app/favicon.ico', 'Favicon/favicon.ico'],
  ['src/app/icon.svg', 'Favicon/icon.svg'],
  ['src/app/apple-icon.png', 'Favicon/apple-touch-icon.png'],
  ['src/app/opengraph-image.png', 'Social/og-marketing-en.png'],
  ['src/app/admin/opengraph-image.png', 'Social/og-dashboard-en.png'],
  ['public/icon-192.png', 'Favicon/icon-192.png'],
  ['public/icon-72.png', 'Favicon/notification-badge-72.png'],
];

const LIGHT = {
  bg: '#fff4f8',
  face: '#ffffff',
  track: '#ffe0ec',
  arc: '#d6336c',
  line: '#33263a',
  cheek: '#ffc2d6',
  name: '#33263a',
  accent: '#d6336c',
  muted: '#6e5b70',
};
const DARK = {
  bg: '#1e1622',
  face: '#2a2030',
  track: '#3a2c40',
  arc: '#f2558b',
  line: '#fff4f8',
  cheek: '#7a3550',
  name: '#fff4f8',
  accent: '#f2558b',
  muted: '#c9b8cc',
};
const TAGLINE = { en: 'For the days before the big day', it: 'Per i giorni prima del grande giorno' };

const OG = {
  'og-marketing-en': { line: TAGLINE.en, pill: 'loading.baby' },
  'og-marketing-it': { line: TAGLINE.it, pill: 'loading.baby' },
  'og-dashboard-en': { line: 'Your page, your updates, everyone waiting with you', pill: 'Dashboard' },
  'og-dashboard-it': { line: 'La tua pagina, i tuoi aggiornamenti, chi aspetta con te', pill: 'Dashboard' },
};

// The mark lives on a 100-unit grid; this square crop holds the ring and the curl.
const MARK_BOX = { x: 4.5, y: 5, size: 91 };
const MARK_VIEWBOX = `${MARK_BOX.x} ${MARK_BOX.y} ${MARK_BOX.size} ${MARK_BOX.size}`;
const RING_CENTER_Y = (56 - MARK_BOX.y) / MARK_BOX.size;

/** Static faces from Google Fonts, kept in node_modules/.cache so a rebuild works offline. */
async function loadFont(family, weight) {
  const file = join(FONT_CACHE, `${family}-${weight}.woff`);
  if (!existsSync(file)) {
    // An older browser's user agent makes Google Fonts answer with a whole static WOFF.
    const userAgent = 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Chrome/12.0 Safari/534.30';
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, {
        headers: { 'User-Agent': userAgent },
      })
    ).text();
    const url = css.match(/url\((https:[^)]+\.woff)\)/)?.[1];
    if (!url) {
      throw new Error(`No WOFF for ${family} ${weight} in Google Fonts' answer`);
    }
    mkdirSync(FONT_CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  }
  return { file, font: opentype.loadSync(file) };
}

/** The Sleepy spinner on the 100-unit grid. `cut` thickens the strokes and drops detail for small sizes. */
function markBody(c, cut = 'full') {
  const [ring, curl, eyes] = { full: [8, 5, 4.5], fav32: [11, 7, 7], fav16: [14, 10, 0] }[cut];
  let s = '';
  if (c.track) {
    s += `<circle cx="50" cy="56" r="34" fill="${c.face || 'none'}" stroke="${c.track}" stroke-width="${ring}"/>`;
  }
  s += `<circle cx="50" cy="56" r="34" fill="none" stroke="${c.arc}" stroke-width="${ring}" stroke-linecap="round" pathLength="100" stroke-dasharray="68 100" transform="rotate(-80 50 56)"/>`;
  s += `<path d="M50 22 C 43 13 57 8 55 17" fill="none" stroke="${c.line}" stroke-width="${curl}" stroke-linecap="round"/>`;
  if (cut === 'full') {
    if (c.cheek) {
      s += `<ellipse cx="34" cy="65" rx="5" ry="3.2" fill="${c.cheek}"/><ellipse cx="66" cy="65" rx="5" ry="3.2" fill="${c.cheek}"/>`;
    }
    s += `<path d="M35 55 Q40 60 45 55 M55 55 Q60 60 65 55" fill="none" stroke="${c.line}" stroke-width="${eyes}" stroke-linecap="round"/>`;
    s += `<circle cx="50" cy="68" r="2.6" fill="none" stroke="${c.line}" stroke-width="3.5"/>`;
  } else if (cut === 'fav32') {
    s += `<path d="M34 55 Q40 61 46 55 M54 55 Q60 61 66 55" fill="none" stroke="${c.line}" stroke-width="${eyes}" stroke-linecap="round"/>`;
  }
  return s;
}

const svgDoc = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" role="img" aria-label="Loading Baby"><title>Loading Baby</title>${body}</svg>\n`;

const markSvg = (c, cut) => svgDoc(512, 512, markBody(c, cut), MARK_VIEWBOX);

const nestedMark = (c, x, y, size) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">${markBody(c)}</svg>`;

const fredokaFace = await loadFont('Fredoka', 600);
const nunitoFace = await loadFont('Nunito', 700);
const fredoka = fredokaFace.font;
const nunito = nunitoFace.font;

/** Text as outlines: the path data for `text`, its left edge at x and baseline at y. */
function textPath(font, text, x, y, size) {
  return {
    d: font.getPath(text, x, y, size, { kerning: true }).toPathData(2),
    width: font.getAdvanceWidth(text, size, { kerning: true }),
  };
}

/** "Loading Baby" as outlines, in two runs so "Baby" takes the accent. */
function wordmark(c, x, baseline, size) {
  const loading = textPath(fredoka, 'Loading ', x, baseline, size);
  const baby = textPath(fredoka, 'Baby', x + loading.width, baseline, size);
  return {
    svg: `<path fill="${c.name}" d="${loading.d}"/><path fill="${c.accent}" d="${baby.d}"/>`,
    width: loading.width + baby.width,
  };
}

const capHeight = (font, size) => (font.tables.os2.sCapHeight / font.unitsPerEm) * size;
const descent = (font, size) => (-font.descender / font.unitsPerEm) * size;

/** The mark on the left, the name (and the tagline) beside it, centred on the ring. */
function horizontal(c, lang) {
  const size = 100;
  const tagSize = 30;
  const cap = capHeight(fredoka, size);
  const tagDrop = 26 + capHeight(nunito, tagSize) + 6;
  const block = cap + (lang ? tagDrop : 0);
  const mark = lang ? Math.max(block * 1.25, 150) : cap * 2.3;
  const pad = 8;
  const textX = pad + mark * 1.16;
  const baseline = pad + mark * RING_CENTER_Y - block / 2 + cap;
  const wm = wordmark(c, textX, baseline, size);
  let body = nestedMark(c, pad, pad, mark) + wm.svg;
  let width = textX + wm.width;
  let bottom = Math.max(pad + mark, baseline + descent(fredoka, size) * 0.6);
  if (lang) {
    const tag = textPath(nunito, TAGLINE[lang], textX + 3, baseline + tagDrop, tagSize);
    body += `<path fill="${c.muted}" d="${tag.d}"/>`;
    width = Math.max(width, textX + 3 + tag.width);
    bottom = Math.max(bottom, baseline + tagDrop + descent(nunito, tagSize));
  }
  return svgDoc(Math.ceil(width + pad), Math.ceil(bottom + pad), body);
}

/** The mark above, the name and the tagline centred below. */
function stacked(c, lang) {
  const size = 100;
  const mark = 220;
  const tagSize = 34;
  const nameWidth = wordmark(c, 0, 0, size).width;
  const tagWidth = lang ? textPath(nunito, TAGLINE[lang], 0, 0, tagSize).width : 0;
  const width = Math.max(nameWidth, tagWidth, mark) + 16;
  const baseline = 8 + mark + 28 + capHeight(fredoka, size);
  let body = nestedMark(c, (width - mark) / 2, 8, mark) + wordmark(c, (width - nameWidth) / 2, baseline, size).svg;
  let bottom = baseline + descent(fredoka, size) * 0.6;
  if (lang) {
    const tagBaseline = baseline + 62;
    body += `<path fill="${c.muted}" d="${textPath(nunito, TAGLINE[lang], (width - tagWidth) / 2, tagBaseline, tagSize).d}"/>`;
    bottom = tagBaseline + descent(nunito, tagSize);
  }
  return svgDoc(Math.ceil(width), Math.ceil(bottom + 8), body);
}

/** The tab icon: the bolder cut, in its dark colors when the browser is dark. */
function iconSvg() {
  // One class per element, named after its part, for the dark scheme to recolor.
  const body = markBody(LIGHT, 'fav32')
    .replace(
      /<circle ([^>]*)fill="#ffffff" stroke="#ffe0ec"/,
      '<circle class="track" $1fill="#ffffff" stroke="#ffe0ec"'
    )
    .replace(/<circle ([^>]*)stroke="#d6336c"/, '<circle class="arc" $1stroke="#d6336c"')
    .replace(/<path ([^>]*)stroke="#33263a"/g, '<path class="line" $1stroke="#33263a"');
  const style = `<style>@media (prefers-color-scheme: dark){.track{fill:${DARK.face};stroke:${DARK.track}}.arc{stroke:${DARK.arc}}.line{stroke:${DARK.line}}}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}"><title>Loading Baby</title>${style}${body}</svg>\n`;
}

/** An ICO of PNG images, which every current browser reads. */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    head.writeUInt8(size, entry);
    head.writeUInt8(size, entry + 1);
    head.writeUInt16LE(1, entry + 4);
    head.writeUInt16LE(32, entry + 6);
    head.writeUInt32LE(data.length, entry + 8);
    head.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

/** A 1200 × 630 Open Graph image. */
function ogHtml({ line, pill }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fredoka;font-weight:600;src:url(file://${fredokaFace.file})}
@font-face{font-family:Nunito;font-weight:700;src:url(file://${nunitoFace.file})}
html,body{margin:0}
.og{position:relative;width:1200px;height:630px;overflow:hidden;background:${LIGHT.bg};font-family:Nunito;color:${LIGHT.name}}
.c{position:absolute;border-radius:50%}
.card{position:absolute;left:90px;top:125px;width:380px;height:380px;border-radius:72px;background:#fff;box-shadow:0 4px 8px rgb(51 38 58/.05),0 24px 60px rgb(51 38 58/.12);display:flex;align-items:center;justify-content:center}
.t{position:absolute;left:540px;top:0;bottom:0;right:60px;display:flex;flex-direction:column;justify-content:center}
h1{margin:0;font-family:Fredoka;font-weight:600;font-size:128px;line-height:1}
h1 span{color:${LIGHT.accent}}
p{margin:22px 0 0;font-weight:700;font-size:${line.length > 34 ? 34 : 40}px;line-height:1.25}
.pill{align-self:flex-start;margin-top:26px;padding:8px 22px;border-radius:999px;background:${LIGHT.track};color:#b73163;font-weight:700;font-size:28px}
</style></head><body><div class="og">
<div class="c" style="left:780px;top:-290px;width:660px;height:660px;background:#ffdde8"></div>
<div class="c" style="left:1000px;top:490px;width:300px;height:300px;background:#bef0df"></div>
<div class="c" style="left:-60px;top:520px;width:180px;height:180px;background:#ffe39b"></div>
<div class="card"><svg width="280" height="280" viewBox="${MARK_VIEWBOX}">${markBody(LIGHT)}</svg></div>
<div class="t"><h1>Loading<br><span>Baby</span></h1><p>${line}</p><div class="pill">${pill}</div></div>
</div></body></html>`;
}

function write(path, data) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

for (const folder of ['Logo', 'Favicon', 'Social']) {
  rmSync(join(OUT, folder), { recursive: true, force: true });
}

const mono = (color) => ({ arc: color, line: color });
const svgs = {
  mark: markSvg(LIGHT),
  'mark-on-dark': markSvg(DARK),
  'mark-plum': markSvg(mono(LIGHT.line)),
  'mark-white': markSvg(mono('#ffffff')),
};
for (const [layout, build] of [
  ['horizontal', horizontal],
  ['stacked', stacked],
]) {
  for (const lang of [undefined, 'en', 'it']) {
    const name = `logo-${layout}${lang ? `-tagline-${lang}` : ''}`;
    svgs[name] = build(LIGHT, lang);
    svgs[`${name}-on-dark`] = build(DARK, lang);
  }
}

const browser = await chromium.launch();
const tab = await browser.newPage();

/** An SVG at `width` px: PNG on transparent, or JPG on `bg` with room around it. */
async function raster(svg, width, type, bg) {
  const [, w, h] = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
  const height = Math.round((width * Number(h)) / Number(w));
  const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${height}"`);
  const pad = bg ? Math.round(width * 0.12) : 0;
  await tab.setViewportSize({ width: width + 2 * pad, height: height + 2 * pad });
  await tab.setContent(
    `<body style="margin:0;background:${bg || 'transparent'}"><div style="padding:${pad}px;display:inline-block">${sized}</div></body>`
  );
  return tab.screenshot({ type, omitBackground: !bg, quality: type === 'jpeg' ? 92 : undefined });
}

/** A square app icon: the mark on the blush page, `inset` of the side left around it. */
async function tile(size, inset) {
  const mark = Math.round(size * (1 - 2 * inset));
  await tab.setViewportSize({ width: size, height: size });
  await tab.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;background:${LIGHT.bg};display:flex;align-items:center;justify-content:center"><svg width="${mark}" height="${mark}" viewBox="${MARK_VIEWBOX}">${markBody(LIGHT)}</svg></body>`
  );
  return tab.screenshot({ type: 'png' });
}

for (const [name, svg] of Object.entries(svgs)) {
  const dark = name.includes('on-dark') || name === 'mark-white';
  const width = name.startsWith('mark') ? 1024 : 2000;
  write(`Logo/SVG/${name}.svg`, svg);
  write(`Logo/PNG/${name}.png`, await raster(svg, width, 'png'));
  write(`Logo/JPG/${name}.jpg`, await raster(svg, width, 'jpeg', dark ? DARK.bg : LIGHT.bg));
}

const favicons = [];
for (const size of [16, 32, 48]) {
  const data = await raster(markSvg(LIGHT, size < 24 ? 'fav16' : 'fav32'), size, 'png');
  favicons.push({ size, data });
  write(`Favicon/favicon-${size}.png`, data);
}
write('Favicon/favicon.ico', ico(favicons));
write('Favicon/icon.svg', iconSvg());
write('Favicon/apple-touch-icon.png', await tile(180, 0.12));
write('Favicon/icon-192.png', await tile(192, 0.1));
write('Favicon/icon-512.png', await tile(512, 0.1));
// A launcher may crop a maskable icon to a circle 80% wide, so its mark keeps to the middle.
write('Favicon/icon-maskable-512.png', await tile(512, 0.2));
// Android draws a notification badge as a mask: one color on transparent.
write('Favicon/notification-badge-72.png', await raster(markSvg(mono('#ffffff'), 'fav32'), 72, 'png'));

// The Open Graph pages load the fonts from disk, so they open from a file, not a string.
await tab.setViewportSize({ width: 1200, height: 630 });
const page = join(tmpdir(), 'brand-kit-og.html');
for (const [name, og] of Object.entries(OG)) {
  writeFileSync(page, ogHtml(og));
  await tab.goto(`file://${page}`);
  await tab.evaluate(() => document.fonts.ready);
  write(`Social/${name}.png`, await tab.screenshot({ type: 'png' }));
  write(`Social/${name}.jpg`, await tab.screenshot({ type: 'jpeg', quality: 90 }));
}
rmSync(page);
await browser.close();

for (const [destination, source] of APP_COPIES) {
  copyFileSync(join(OUT, source), join(ROOT, destination));
}
console.log(`Brand kit written to brand/, and ${APP_COPIES.length} files copied into the app.`);
