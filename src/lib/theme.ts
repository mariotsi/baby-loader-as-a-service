/**
 * Curated theming: Owners pick from a fixed list of palettes and fonts
 * rather than supplying free-form CSS or font URLs. This keeps every Site
 * fast (no arbitrary remote assets), safe (no injected CSS/JS), and cheap
 * (a handful of known Google Fonts, not one download per Site).
 *
 * A Palette sets every color token of the design system and a Font sets every
 * typography token (`src/styles/tokens.css` holds the rest). `theme.test.ts`
 * checks each Palette against WCAG 2.2 AA, so a new or retuned Palette that
 * fails a pairing fails CI.
 */

export interface ColorTokens {
  /** Tells the browser to draw native parts (date pickers, dropdowns, scrollbars) for a light or dark page. */
  '--color-scheme': 'light' | 'dark';
  /** Page background. */
  '--color-bg': string;
  /** Cards, inputs and other raised surfaces. */
  '--color-surface': string;
  /** Body text, on bg, surface and soft. */
  '--color-text': string;
  /** Supporting text, on bg, surface and soft. */
  '--color-text-muted': string;
  /** Fill of primary controls: buttons, checked switches and checkboxes. */
  '--color-accent': string;
  /** Text and icons on an accent fill. */
  '--color-on-accent': string;
  /** Accent-coloured text, focus rings and selected outlines, on bg, surface and soft. */
  '--color-accent-ink': string;
  /** Quiet tint for chips, progress tracks and hover fills. Never a control's only boundary. */
  '--color-soft': string;
  /** Boundary of inputs and unselected controls: at least 3:1 against bg and surface. */
  '--color-border': string;
  /** Decorative shapes behind the content. Text can land on them, so text, muted and accent text must pass on each. */
  '--color-joy-1': string;
  '--color-joy-2': string;
  '--color-joy-3': string;
  '--color-danger': string;
  '--color-success': string;
}

export interface Palette {
  id: string;
  name: string;
  /** CSS custom property values, applied on the root element of what it themes. */
  vars: ColorTokens;
}

const LIGHT_STATUS = { '--color-danger': '#b0373b', '--color-success': '#217049' } as const;
const LIGHT: Pick<ColorTokens, '--color-scheme'> = { '--color-scheme': 'light' };

/** The Platform's own colors: the marketing, auth, onboarding and Dashboard pages. Owners cannot pick it. */
export const PLATFORM_PALETTE: Palette = {
  id: 'platform',
  name: 'Platform',
  vars: {
    ...LIGHT,
    '--color-bg': '#fff4f8',
    '--color-surface': '#ffffff',
    '--color-text': '#33263a',
    '--color-text-muted': '#726071',
    '--color-accent': '#d6336c',
    '--color-on-accent': '#ffffff',
    '--color-accent-ink': '#b73163',
    '--color-soft': '#ffe0ec',
    '--color-border': '#998393',
    '--color-joy-1': '#ffdde8',
    '--color-joy-2': '#ffe39b',
    '--color-joy-3': '#bef0df',
    ...LIGHT_STATUS,
  },
};

export const PALETTES: Palette[] = [
  {
    id: 'blush',
    name: 'Blush',
    vars: {
      ...LIGHT,
      '--color-bg': '#fff4f6',
      '--color-surface': '#ffffff',
      '--color-text': '#3d2430',
      '--color-text-muted': '#795f6a',
      '--color-accent': '#c2365f',
      '--color-on-accent': '#ffffff',
      '--color-accent-ink': '#b6345b',
      '--color-soft': '#fde2ea',
      '--color-border': '#9d838d',
      '--color-joy-1': '#ffdee6',
      '--color-joy-2': '#ffe7a8',
      '--color-joy-3': '#c9f0e1',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'sky',
    name: 'Sky',
    vars: {
      ...LIGHT,
      '--color-bg': '#f1f7ff',
      '--color-surface': '#ffffff',
      '--color-text': '#1f2d3d',
      '--color-text-muted': '#586677',
      '--color-accent': '#2b67c9',
      '--color-on-accent': '#ffffff',
      '--color-accent-ink': '#2a63bf',
      '--color-soft': '#dceafd',
      '--color-border': '#7d8b9d',
      '--color-joy-1': '#d6e7ff',
      '--color-joy-2': '#d8f3ff',
      '--color-joy-3': '#ffe3c9',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    vars: {
      ...LIGHT,
      '--color-bg': '#f3f7ee',
      '--color-surface': '#ffffff',
      '--color-text': '#28331f',
      '--color-text-muted': '#5e6954',
      '--color-accent': '#4c7a2e',
      '--color-on-accent': '#ffffff',
      '--color-accent-ink': '#47702c',
      '--color-soft': '#e1ecd6',
      '--color-border': '#818c77',
      '--color-joy-1': '#daebcb',
      '--color-joy-2': '#fff0c2',
      '--color-joy-3': '#d9efe8',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    vars: {
      ...LIGHT,
      '--color-bg': '#f7f3fd',
      '--color-surface': '#ffffff',
      '--color-text': '#2e2640',
      '--color-text-muted': '#665e78',
      '--color-accent': '#7351c0',
      '--color-on-accent': '#ffffff',
      '--color-accent-ink': '#6a4ab4',
      '--color-soft': '#e9e0fa',
      '--color-border': '#8d859f',
      '--color-joy-1': '#e6dbfc',
      '--color-joy-2': '#ffd9ec',
      '--color-joy-3': '#d4ecff',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'sunshine',
    name: 'Sunshine',
    vars: {
      ...LIGHT,
      '--color-bg': '#fff9ec',
      '--color-surface': '#ffffff',
      '--color-text': '#3d2f14',
      '--color-text-muted': '#756649',
      '--color-accent': '#f2b33d',
      '--color-on-accent': '#3d2f14',
      '--color-accent-ink': '#846224',
      '--color-soft': '#fdeccb',
      '--color-border': '#998a6c',
      '--color-joy-1': '#ffe8a7',
      '--color-joy-2': '#ffe5d1',
      '--color-joy-3': '#d8f1c9',
      ...LIGHT_STATUS,
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      '--color-scheme': 'dark',
      '--color-bg': '#12131c',
      '--color-surface': '#1c1e2b',
      '--color-text': '#eef0f8',
      '--color-text-muted': '#999cab',
      '--color-accent': '#8aa6ff',
      '--color-on-accent': '#0c0d14',
      '--color-accent-ink': '#8aa6ff',
      '--color-soft': '#2c3048',
      '--color-border': '#6a6d80',
      '--color-joy-1': '#223062',
      '--color-joy-2': '#3f285c',
      '--color-joy-3': '#1b373a',
      '--color-danger': '#ff6e6e',
      '--color-success': '#34c47f',
    },
  },
];

export const DEFAULT_PALETTE = PALETTES[0].id;

export function getPalette(id: string | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function isPaletteId(id: string | undefined): id is string {
  return !!id && PALETTES.some((p) => p.id === id);
}

/** One face of a Font: the CSS stack and the weight it is set in. */
export interface Typeface {
  cssStack: string;
  weight: number;
}

/** A Font pairs a display face (the baby's name, the Countdown, headings) with a body face. */
export interface FontOption {
  id: string;
  name: string;
  display: Typeface;
  body: Typeface;
  /** Google Fonts family specs both faces need, used to build the stylesheet <link>. */
  googleFamilies: string[];
}

const INTER = 'Inter:wght@400;500;600;700';
const INTER_STACK = "'Inter', system-ui, sans-serif";

/** The Platform's own typefaces. Owners cannot pick it. */
export const PLATFORM_FONT: FontOption = {
  id: 'platform',
  name: 'Platform',
  display: { cssStack: "'Fredoka', 'Nunito', system-ui, sans-serif", weight: 600 },
  body: { cssStack: "'Nunito', system-ui, sans-serif", weight: 500 },
  googleFamilies: ['Fredoka:wght@500;600;700', 'Nunito:wght@400;500;600;700;800'],
};

export const FONTS: FontOption[] = [
  {
    id: 'inter',
    name: 'Inter',
    display: { cssStack: INTER_STACK, weight: 700 },
    body: { cssStack: INTER_STACK, weight: 400 },
    googleFamilies: [INTER],
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    display: { cssStack: "'Playfair Display', Georgia, serif", weight: 700 },
    body: { cssStack: INTER_STACK, weight: 400 },
    googleFamilies: ['Playfair+Display:wght@600;700', INTER],
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    display: { cssStack: "'Quicksand', system-ui, sans-serif", weight: 700 },
    body: { cssStack: "'Quicksand', system-ui, sans-serif", weight: 500 },
    googleFamilies: ['Quicksand:wght@500;600;700'],
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    display: { cssStack: "'Merriweather', Georgia, serif", weight: 700 },
    body: { cssStack: INTER_STACK, weight: 400 },
    googleFamilies: ['Merriweather:wght@400;700', INTER],
  },
  {
    id: 'poppins',
    name: 'Poppins',
    display: { cssStack: "'Poppins', system-ui, sans-serif", weight: 600 },
    body: { cssStack: "'Poppins', system-ui, sans-serif", weight: 400 },
    googleFamilies: ['Poppins:wght@400;500;600;700'],
  },
];

export const DEFAULT_FONT = FONTS[0].id;

export function getFont(id: string | undefined): FontOption {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function isFontId(id: string | undefined): id is string {
  return !!id && FONTS.some((f) => f.id === id);
}

/** The typography tokens a Font sets. */
export function fontVars(font: FontOption): Record<string, string> {
  return {
    '--font-display': font.display.cssStack,
    '--font-display-weight': String(font.display.weight),
    '--font-body': font.body.cssStack,
    '--font-body-weight': String(font.body.weight),
  };
}

/** Builds the inline CSS custom properties for a Palette and a Font together. */
export function tokenStyle(palette: Palette, font: FontOption): Record<string, string> {
  return { ...palette.vars, ...fontVars(font) };
}

/** Builds the inline CSS custom properties for a Site's chosen theme. */
export function themeStyle(theme: { palette: string; font: string }): Record<string, string> {
  return tokenStyle(getPalette(theme.palette), getFont(theme.font));
}

/** The Platform's own theme, set on the document root. */
export function platformStyle(): Record<string, string> {
  return tokenStyle(PLATFORM_PALETTE, PLATFORM_FONT);
}

/**
 * A stylesheet setting the tokens on the document root, so the whole document
 * wears the theme, scrollbars and overscroll included. The root layout writes
 * the Platform's; a Public page writes its Site's after it, which wins. The
 * values come only from the curated lists above, never from an Owner.
 */
export function rootTokenCss(tokens: Record<string, string>): string {
  return `:root{${Object.entries(tokens)
    .map(([name, value]) => `${name}:${value}`)
    .join(';')}}`;
}

/** Builds the Google Fonts stylesheet URL for the fonts actually in use. */
export function googleFontsHref(fonts: FontOption[]): string {
  const unique = Array.from(new Set(fonts.flatMap((f) => f.googleFamilies)));
  return `https://fonts.googleapis.com/css2?${unique.map((f) => `family=${f}`).join('&')}&display=swap`;
}
