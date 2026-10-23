'use client';

import type { ComponentProps } from 'react';
import styles from './control.module.css';
import { useFieldControlProps } from './Field';

/** A multi-line text control. Put it in a `Field`, or give it an `aria-label`. */
export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      {...useFieldControlProps(props)}
      className={[styles.control, styles.textarea, className].filter(Boolean).join(' ')}
    />
  );
}
