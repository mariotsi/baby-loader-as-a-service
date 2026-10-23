'use client';

import { type ComponentProps, type ReactNode, useId } from 'react';
import styles from './Switch.module.css';

type SwitchProps = Omit<ComponentProps<'input'>, 'type' | 'role'> & {
  label: ReactNode;
  hint?: ReactNode;
};

/**
 * An on or off setting, like showing the baby's name while waiting. It is a
 * native checkbox announced as a switch, so it submits with a form and works
 * with the keyboard as one.
 */
export function Switch({ label, hint, className, ...props }: SwitchProps) {
  const hintId = useId();
  return (
    <label className={[styles.root, className].filter(Boolean).join(' ')}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint ? (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </span>
      <input
        {...props}
        type="checkbox"
        // biome-ignore lint/a11y/useAriaPropsForRole: a native checkbox already exposes its checked state to the switch role; ARIA in HTML forbids aria-checked on it, which would also go stale while uncontrolled.
        role="switch"
        className={styles.input}
        aria-describedby={hint ? hintId : undefined}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
