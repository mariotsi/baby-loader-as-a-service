'use client';

import type { ComponentProps } from 'react';
import styles from './control.module.css';
import { useFieldControlProps } from './Field';
import { Icon } from './Icon';

/**
 * A native dropdown, so every phone shows its own accessible picker. Use it
 * for five options or more; for fewer, a `SegmentedControl` shows them all.
 */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <span className={styles.selectWrap}>
      <select
        {...useFieldControlProps(props)}
        className={[styles.control, styles.select, className].filter(Boolean).join(' ')}
      >
        {children}
      </select>
      <Icon name="chevron-down" className={styles.chevron} />
    </span>
  );
}
