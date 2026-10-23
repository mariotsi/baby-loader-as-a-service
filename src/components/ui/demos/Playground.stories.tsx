import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type CSSProperties, useState } from 'react';
import {
  FONTS,
  getFont,
  getPalette,
  PALETTES,
  PLATFORM_FONT,
  PLATFORM_PALETTE,
  platformStyle,
  tokenStyle,
} from '@/lib/theme';
import { Card } from '../Card';
import { FontPicker } from '../FontPicker';
import { PalettePicker } from '../PalettePicker';
import { ComponentSheet } from './ComponentSheet';
import { ContrastReport } from './ContrastReport';
import styles from './playground.module.css';

const ALL_PALETTES = [PLATFORM_PALETTE, ...PALETTES];
const ALL_FONTS = [PLATFORM_FONT, ...FONTS];

const meta = {
  title: 'Playground',
  parameters: { page: true },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** A phone-sized frame showing a demo story at a real 375px viewport, so its media queries apply. */
function Phone({ story, label, palette, font }: { story: string; label: string; palette: string; font: string }) {
  return (
    <figure className={styles.phone}>
      <iframe
        title={`${label} at 375 pixels wide`}
        className={styles.screen}
        src={`iframe.html?id=demos--${story}&viewMode=story&globals=palette:${palette};font:${font}`}
      />
      <figcaption className={styles.caption}>{label}</figcaption>
    </figure>
  );
}

/**
 * Every component on one page. Pick a Palette and a Font: the phones and the
 * component sheet restyle through the tokens alone, and the contrast report
 * shows how the Palette measures against WCAG AA.
 */
export const AllComponents: Story = {
  name: 'All components',
  render: function Playground() {
    const [paletteId, setPaletteId] = useState('blush');
    const [fontId, setFontId] = useState('quicksand');
    const palette = ALL_PALETTES.find((p) => p.id === paletteId) ?? getPalette(paletteId);
    const font = ALL_FONTS.find((f) => f.id === fontId) ?? getFont(fontId);
    return (
      <div className={styles.playground} style={platformStyle() as CSSProperties}>
        <header className={styles.controls}>
          <h1 className={styles.title}>Playground</h1>
          <Card>
            <div className={styles.pickers}>
              <PalettePicker value={paletteId} onChange={setPaletteId} palettes={ALL_PALETTES} />
              <FontPicker value={fontId} onChange={setFontId} fonts={ALL_FONTS} sample="Emma" />
            </div>
          </Card>
        </header>
        <div className={styles.themed} style={tokenStyle(palette, font) as CSSProperties}>
          <div className={styles.phones}>
            <Phone story="public-page-waiting" label="Waiting state" palette={paletteId} font={fontId} />
            <Phone story="public-page-born" label="Born state" palette={paletteId} font={fontId} />
          </div>
          <ComponentSheet />
        </div>
        <section className={styles.contrast}>
          <h2 className={styles.title}>Contrast</h2>
          <ContrastReport palette={palette} />
        </section>
      </div>
    );
  },
};

/** The component sheet in every Palette at once: the accessibility check runs axe over all of them. */
export const EveryPalette: Story = {
  name: 'Every Palette',
  render: () => (
    <div className={styles.playground}>
      {ALL_PALETTES.map((palette) => (
        <section
          key={palette.id}
          className={styles.themed}
          style={tokenStyle(palette, palette.id === 'platform' ? PLATFORM_FONT : FONTS[0]) as CSSProperties}
          aria-label={palette.name}
        >
          <h2 className={styles.title}>{palette.name}</h2>
          <ComponentSheet headingLevel={3} themeName={palette.name} />
        </section>
      ))}
    </div>
  ),
};
