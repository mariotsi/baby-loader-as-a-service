'use client';

import { type CSSProperties, useId } from 'react';
import { PALETTES, type Palette } from '@/lib/theme';
import { Icon } from './Icon';
import styles from './PalettePicker.module.css';

interface PalettePickerProps {
  value: string;
  onChange: (paletteId: string) => void;
  legend?: string;
  palettes?: Palette[];
}

/**
 * Picks a Site's Palette. Each option previews the Palette's page, accent
 * and decoration colors, and is named, so it never relies on color alone.
 * The options fit one row, or two even rows in a narrow container: six
 * Palettes make two rows of three on a phone.
 */
export function PalettePicker({ value, onChange, legend = 'Palette', palettes = PALETTES }: PalettePickerProps) {
  const name = useId();
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>{legend}</legend>
      <div
        className={styles.options}
        style={{ '--count': palettes.length, '--half': Math.ceil(palettes.length / 2) } as CSSProperties}
      >
        {palettes.map((palette) => {
          const preview = {
            '--swatch-bg': palette.vars['--color-bg'],
            '--swatch-edge': palette.vars['--color-border'],
            '--swatch-accent': palette.vars['--color-accent'],
            '--swatch-on-accent': palette.vars['--color-on-accent'],
            '--swatch-joy-1': palette.vars['--color-joy-1'],
            '--swatch-joy-2': palette.vars['--color-joy-2'],
          } as CSSProperties;
          return (
            <label key={palette.id} className={styles.option}>
              <input
                type="radio"
                className={styles.input}
                name={name}
                value={palette.id}
                checked={palette.id === value}
                onChange={() => onChange(palette.id)}
              />
              <span className={styles.swatch} style={preview} aria-hidden="true">
                <span className={styles.joy} />
                <span className={styles.dot}>
                  <Icon name="check" className={styles.check} />
                </span>
              </span>
              <span className={styles.name}>{palette.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
