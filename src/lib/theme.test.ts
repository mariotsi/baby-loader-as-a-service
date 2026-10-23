import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contrastRatio, paletteContrastPairings } from './contrast.ts';
import {
  FONTS,
  fontVars,
  googleFontsHref,
  PALETTES,
  PLATFORM_FONT,
  PLATFORM_PALETTE,
  rootTokenCss,
  themeStyle,
} from './theme.ts';

for (const palette of [PLATFORM_PALETTE, ...PALETTES]) {
  test(`the ${palette.name} Palette meets WCAG AA on every pairing the components render`, () => {
    const failures = paletteContrastPairings(palette.vars)
      .map((p) => ({ ...p, ratio: contrastRatio(p.fg, p.bg) }))
      .filter((p) => p.ratio < p.min)
      .map((p) => `${p.use}: ${p.fg} on ${p.bg} is ${p.ratio.toFixed(2)}:1, needs ${p.min}:1`);
    assert.deepEqual(failures, []);
  });
}

test('every Palette sets the same color tokens as the Platform', () => {
  const tokens = Object.keys(PLATFORM_PALETTE.vars).sort((a, b) => a.localeCompare(b));
  for (const palette of PALETTES) {
    assert.deepEqual(
      Object.keys(palette.vars).sort((a, b) => a.localeCompare(b)),
      tokens,
      palette.id
    );
  }
});

test('contrastRatio matches the WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21);
  assert.equal(contrastRatio('#ffffff', '#ffffff'), 1);
  assert.equal(contrastRatio('#767676', '#ffffff').toFixed(2), '4.54');
});

test('themeStyle sets the color and typography tokens of the chosen Palette and Font', () => {
  const style = themeStyle({ palette: 'midnight', font: 'playfair' });
  assert.equal(style['--color-bg'], '#12131c');
  assert.equal(style['--font-display'], "'Playfair Display', Georgia, serif");
  assert.equal(style['--font-body'], "'Inter', system-ui, sans-serif");
  assert.equal(style['--font-display-weight'], '700');
});

test('themeStyle falls back to the first Palette and Font for an unknown id', () => {
  const style = themeStyle({ palette: 'neon', font: 'comic' });
  assert.equal(style['--color-bg'], PALETTES[0].vars['--color-bg']);
  assert.equal(style['--font-display'], FONTS[0].display.cssStack);
});

test('googleFontsHref requests each family once', () => {
  const href = googleFontsHref([FONTS[2], FONTS[3], PLATFORM_FONT]);
  assert.equal(
    href,
    'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Merriweather:wght@400;700&family=Inter:wght@400;500;600;700&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap'
  );
  assert.equal(googleFontsHref([FONTS[1], FONTS[0]]).match(/family=Inter/g)?.length, 1);
});

test('rootTokenCss writes the tokens as one :root rule', () => {
  assert.equal(
    rootTokenCss({ '--color-bg': '#fff', '--font-body': "'Inter', sans-serif" }),
    ":root{--color-bg:#fff;--font-body:'Inter', sans-serif}"
  );
});

test('fontVars names the four typography tokens', () => {
  assert.deepEqual(
    Object.keys(fontVars(PLATFORM_FONT)).sort((a, b) => a.localeCompare(b)),
    ['--font-body', '--font-body-weight', '--font-display', '--font-display-weight']
  );
});
