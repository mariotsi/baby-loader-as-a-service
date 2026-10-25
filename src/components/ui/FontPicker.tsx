'use client';

import { type CSSProperties, useId } from 'react';
import { useLang } from '@/components/LangProvider';
import { uiCopy } from '@/lib/copy/ui';
import { FONTS, type FontOption } from '@/lib/theme';
import styles from './FontPicker.module.css';
import { Icon } from './Icon';

interface FontPickerProps {
  value: string;
  onChange: (fontId: string) => void;
  legend?: string;
  /** What each option writes in its own Font, like the baby's name. */
  sample?: string;
  fonts?: FontOption[];
}

/** Picks a Site's Font. Each option writes the sample in the Font's display face. */
export function FontPicker({ value, onChange, legend, sample = 'Aa', fonts = FONTS }: FontPickerProps) {
  const t = uiCopy[useLang()];
  const name = useId();
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>{legend ?? t.font}</legend>
      <div className={styles.options}>
        {fonts.map((font) => (
          <label key={font.id} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={font.id}
              checked={font.id === value}
              onChange={() => onChange(font.id)}
            />
            <span className={styles.card}>
              <span
                className={styles.sample}
                style={
                  { '--sample-font': font.display.cssStack, '--sample-weight': font.display.weight } as CSSProperties
                }
                aria-hidden="true"
              >
                {sample}
              </span>
              <span className={styles.name}>{font.name}</span>
              <Icon name="circle-check" className={styles.check} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
