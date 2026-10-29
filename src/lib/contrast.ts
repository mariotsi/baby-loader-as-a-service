import type { ColorTokens } from './theme.ts';

/** WCAG 2.2 contrast between two `#rrggbb` colors, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** AA minimum for text (1.4.3); large display text still gets the full ratio here, so every size passes. */
export const TEXT_MIN = 4.5;
/** AA minimum for control boundaries, states and focus indicators (1.4.11). */
export const NON_TEXT_MIN = 3;

export interface ContrastPairing {
  /** What the pairing is used for, in words. */
  use: string;
  fg: string;
  bg: string;
  min: number;
}

/** Every foreground and background pairing the components render, with the minimum each must meet. */
export function paletteContrastPairings(vars: ColorTokens): ContrastPairing[] {
  const surfaces = {
    page: vars['--color-bg'],
    card: vars['--color-surface'],
    tint: vars['--color-soft'],
    success: vars['--color-success-soft'],
    error: vars['--color-danger-soft'],
    'decoration 1': vars['--color-joy-1'],
    'decoration 2': vars['--color-joy-2'],
    'decoration 3': vars['--color-joy-3'],
  };
  const decorations = ['decoration 1', 'decoration 2', 'decoration 3'] as const;
  const onEach = (use: string, fg: string, min: number, on: (keyof typeof surfaces)[]) =>
    on.map((s) => ({ use: `${use} on ${s}`, fg, bg: surfaces[s], min }));
  return [
    ...onEach('Text', vars['--color-text'], TEXT_MIN, ['page', 'card', 'tint', 'success', 'error', ...decorations]),
    ...onEach('Muted text', vars['--color-text-muted'], TEXT_MIN, [
      'page',
      'card',
      'tint',
      'success',
      'error',
      ...decorations,
    ]),
    ...onEach('Accent text', vars['--color-accent-ink'], TEXT_MIN, ['page', 'card', 'tint', ...decorations]),
    ...onEach('Error text', vars['--color-danger'], TEXT_MIN, ['page', 'card', 'error']),
    ...onEach('Success text', vars['--color-success'], TEXT_MIN, ['page', 'card', 'success']),
    { use: 'Text on accent fill', fg: vars['--color-on-accent'], bg: vars['--color-accent'], min: TEXT_MIN },
    ...onEach('File picker success border', vars['--color-success'], NON_TEXT_MIN, ['card']),
    ...onEach('File picker error border', vars['--color-danger'], NON_TEXT_MIN, ['card']),
    ...onEach('Control border', vars['--color-border'], NON_TEXT_MIN, ['page', 'card']),
    ...onEach('Focus ring and selected outline', vars['--color-accent-ink'], NON_TEXT_MIN, ['page', 'card']),
  ];
}
