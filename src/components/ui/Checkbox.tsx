'use client';

import { type ComponentProps, type ReactNode, useId } from 'react';
import styles from './Checkbox.module.css';
import { Icon } from './Icon';

type CheckboxProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: ReactNode;
  hint?: ReactNode;
};

/**
 * A yes or no that the person states, like "The baby has been born". For a
 * setting that shows or hides something, use a `Switch`.
 */
export function Checkbox({ label, hint, className, ...props }: CheckboxProps) {
  const hintId = useId();
  return (
    <label className={[styles.root, className].filter(Boolean).join(' ')}>
      <input {...props} type="checkbox" className={styles.input} aria-describedby={hint ? hintId : undefined} />
      <span className={styles.box} aria-hidden="true">
        <Icon name="check" className={styles.check} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint ? (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </span>
    </label>
  );
}
