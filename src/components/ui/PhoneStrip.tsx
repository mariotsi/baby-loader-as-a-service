import type { ReactNode } from 'react';
import { Button } from './Button';
import styles from './PhoneStrip.module.css';

interface PhoneStripProps {
  /** Where the person stands, like the step or the baby's name. */
  children: ReactNode;
  showLabel: string;
  hideLabel: string;
  open: boolean;
  onToggle: () => void;
  /** The `id` of what the button shows and hides. */
  controls: string;
  /** Something stuck right under the strip carries the shadow for both. */
  joined?: boolean;
}

/**
 * A strip at the top of a phone's screen, in view while filling a field, that
 * shows and hides what sits beside the form from 48rem, where it goes away.
 * It is first in its grid whatever its place in the markup, and pins itself
 * to the top of the screen while open, above what it shows there.
 */
export function PhoneStrip({ children, showLabel, hideLabel, open, onToggle, controls, joined }: PhoneStripProps) {
  const action = open ? hideLabel : showLabel;
  const classes = [styles.strip, open && styles.open, joined && !open && styles.joined].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <span className={styles.label}>{children}</span>
      <Button variant="ghost" size="sm" onClick={onToggle} aria-expanded={open} aria-controls={controls}>
        {action}
      </Button>
    </div>
  );
}
