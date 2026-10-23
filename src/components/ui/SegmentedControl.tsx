'use client';

import { type ReactNode, useId } from 'react';
import styles from './SegmentedControl.module.css';
import { VisuallyHidden } from './VisuallyHidden';

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
}

interface SegmentedControlProps<V extends string> {
  legend: ReactNode;
  /** Keeps the legend for screen readers only, when a heading or the options already say what is being picked. */
  hideLegend?: boolean;
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: 'md' | 'sm';
  /** Spreads the options across the full width, as on a phone. */
  fullWidth?: boolean;
  name?: string;
}

/** Two to four mutually exclusive options, all visible at once: a radio group drawn as pills. */
export function SegmentedControl<V extends string>({
  legend,
  hideLegend,
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  name,
}: SegmentedControlProps<V>) {
  const generatedName = useId();
  const legendContent = hideLegend ? <VisuallyHidden>{legend}</VisuallyHidden> : legend;
  return (
    <fieldset className={[styles.root, fullWidth && styles.fullWidth].filter(Boolean).join(' ')}>
      <legend className={styles.legend}>{legendContent}</legend>
      <div className={[styles.options, size === 'sm' && styles.sm].filter(Boolean).join(' ')}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              className={styles.input}
              name={name ?? generatedName}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.pill}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
