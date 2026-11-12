import { expect, test } from 'vitest';
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
    expect(failures).toStrictEqual([]);
  });
}

test('every Palette sets the same color tokens as the Platform', () => {
  const tokens = Object.keys(PLATFORM_PALETTE.vars).sort((a, b) => a.localeCompare(b));
  for (const palette of PALETTES) {
    expect(
      Object.keys(palette.vars).sort((a, b) => a.localeCompare(b)),
      palette.id
    ).toStrictEqual(tokens);
  }
});

test('contrastRatio matches the WCAG reference values', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  expect(contrastRatio('#767676', '#ffffff').toFixed(2)).toBe('4.54');
});

test('themeStyle sets the color and typography tokens of the chosen Palette and Font', () => {
  const style = themeStyle({ palette: 'midnight', font: 'playfair' });
  expect(style['--color-bg']).toBe('#12131c');
  expect(style['--font-display']).toBe("'Playfair Display', Georgia, serif");
  expect(style['--font-body']).toBe("'Inter', system-ui, sans-serif");
  expect(style['--font-display-weight']).toBe('700');
});

test('themeStyle falls back to the first Palette and Font for an unknown id', () => {
  const style = themeStyle({ palette: 'neon', font: 'comic' });
  expect(style['--color-bg']).toBe(PALETTES[0].vars['--color-bg']);
  expect(style['--font-display']).toBe(FONTS[0].display.cssStack);
});

test('googleFontsHref requests each family once', () => {
  const href = googleFontsHref([FONTS[2], FONTS[3], PLATFORM_FONT]);
  expect(href).toBe(
    'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Merriweather:wght@400;700&family=Inter:wght@400;500;600;700&family=Fredoka:wght@500;600;700&family=Nunito:wght@400;500;600;700;800&display=swap'
  );
  expect(googleFontsHref([FONTS[1], FONTS[0]]).match(/family=Inter/g)?.length).toBe(1);
});

test('rootTokenCss writes the tokens as one :root rule', () => {
  expect(rootTokenCss({ '--color-bg': '#fff', '--font-body': "'Inter', sans-serif" })).toBe(
    ":root{--color-bg:#fff;--font-body:'Inter', sans-serif}"
  );
});

test('fontVars names the four typography tokens', () => {
  expect(Object.keys(fontVars(PLATFORM_FONT)).sort((a, b) => a.localeCompare(b))).toStrictEqual([
    '--font-body',
    '--font-body-weight',
    '--font-display',
    '--font-display-weight',
  ]);
});
