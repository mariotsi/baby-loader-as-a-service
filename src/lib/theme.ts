/**
 * Curated theming: Owners pick from a fixed list of palettes and fonts
 * rather than supplying free-form CSS or font URLs. This keeps every Site
 * site fast (no arbitrary remote assets), safe (no injected CSS/JS), and
 * cheap (a handful of known Google Fonts, not one download per Site).
 */

export interface Palette {
  id: string;
  name: string;
  /** CSS custom property values, applied on the Public page's root element. */
  vars: {
    '--bg': string;
    '--fg': string;
    '--muted': string;
    '--card-bg': string;
    '--accent': string;
    '--accent-contrast': string;
  };
}

export const PALETTES: Palette[] = [
  {
    id: 'blush',
    name: 'Blush',
    vars: {
      '--bg': '#fff5f7',
      '--fg': '#3d2430',
      '--muted': '#8a6b78',
      '--card-bg': '#ffffff',
      '--accent': '#e8869f',
      '--accent-contrast': '#ffffff',
    },
  },
  {
    id: 'sky',
    name: 'Sky',
    vars: {
      '--bg': '#f2f8ff',
      '--fg': '#1f2d3d',
      '--muted': '#5b7189',
      '--card-bg': '#ffffff',
      '--accent': '#4f8ff0',
      '--accent-contrast': '#ffffff',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    vars: {
      '--bg': '#f4f7f0',
      '--fg': '#28331f',
      '--muted': '#647557',
      '--card-bg': '#ffffff',
      '--accent': '#7ba05b',
      '--accent-contrast': '#ffffff',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    vars: {
      '--bg': '#f7f4fc',
      '--fg': '#2e2640',
      '--muted': '#6f6289',
      '--card-bg': '#ffffff',
      '--accent': '#9b7fd4',
      '--accent-contrast': '#ffffff',
    },
  },
  {
    id: 'sunshine',
    name: 'Sunshine',
    vars: {
      '--bg': '#fffaf0',
      '--fg': '#3d2f14',
      '--muted': '#8a7448',
      '--card-bg': '#ffffff',
      '--accent': '#e6a539',
      '--accent-contrast': '#3d2f14',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    vars: {
      '--bg': '#12131c',
      '--fg': '#eef0f8',
      '--muted': '#9a9db3',
      '--card-bg': '#1c1e2b',
      '--accent': '#7c9dfd',
      '--accent-contrast': '#0c0d14',
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

export interface FontOption {
  id: string;
  name: string;
  /** Google Fonts family name, used to build the stylesheet <link>. */
  googleFamily: string;
  /** CSS font-family value including fallbacks. */
  cssStack: string;
}

export const FONTS: FontOption[] = [
  {
    id: 'inter',
    name: 'Inter',
    googleFamily: 'Inter:wght@400;500;600;700',
    cssStack: "'Inter', system-ui, sans-serif",
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    googleFamily: 'Playfair+Display:wght@400;600;700',
    cssStack: "'Playfair Display', Georgia, serif",
  },
  {
    id: 'quicksand',
    name: 'Quicksand',
    googleFamily: 'Quicksand:wght@400;500;600;700',
    cssStack: "'Quicksand', system-ui, sans-serif",
  },
  {
    id: 'merriweather',
    name: 'Merriweather',
    googleFamily: 'Merriweather:wght@400;700',
    cssStack: "'Merriweather', Georgia, serif",
  },
  {
    id: 'poppins',
    name: 'Poppins',
    googleFamily: 'Poppins:wght@400;500;600;700',
    cssStack: "'Poppins', system-ui, sans-serif",
  },
];

export const DEFAULT_FONT = FONTS[0].id;

export function getFont(id: string | undefined): FontOption {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

export function isFontId(id: string | undefined): id is string {
  return !!id && FONTS.some((f) => f.id === id);
}

/** Builds the inline CSS custom properties for a Site's chosen theme. */
export function themeStyle(theme: { palette: string; font: string }): Record<string, string> {
  const palette = getPalette(theme.palette);
  const font = getFont(theme.font);
  return { ...palette.vars, '--font-body': font.cssStack };
}

/** Builds the Google Fonts stylesheet URL for the fonts actually in use. */
export function googleFontsHref(fontIds: string[]): string {
  const families = fontIds.map((id) => FONTS.find((f) => f.id === id)?.googleFamily).filter((v): v is string => !!v);
  const unique = Array.from(new Set(families));
  return `https://fonts.googleapis.com/css2?${unique.map((f) => `family=${f}`).join('&')}&display=swap`;
}
