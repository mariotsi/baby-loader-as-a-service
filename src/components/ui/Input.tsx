'use client';

import type { ComponentProps } from 'react';
import styles from './control.module.css';
import { useFieldControlProps } from './Field';

/** A single-line text control. Put it in a `Field`, or give it an `aria-label`. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...useFieldControlProps(props)} className={[styles.control, className].filter(Boolean).join(' ')} />;
}
