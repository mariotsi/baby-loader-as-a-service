import type { ReactNode } from 'react';
import styles from './StatusPill.module.css';

interface StatusPillProps {
  /** What is true right now, like "Notifications on for this device". */
  children: ReactNode;
  /** One quiet action beside it, like a small inline link Button to turn it off. */
  action?: ReactNode;
  className?: string;
}

/**
 * A quiet, lasting state, like notifications being on. Unlike a
 * StatusMessage it is not the outcome of an action and does not ask for
 * attention: regular text on the surface, a thin border and a success dot.
 * The words carry the state, the dot only decorates it.
 */
export function StatusPill({ children, action, className }: StatusPillProps) {
  return (
    <p className={[styles.pill, className].filter(Boolean).join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      <span>{children}</span>
      {action ? <span className={styles.action}>{action}</span> : null}
    </p>
  );
}
