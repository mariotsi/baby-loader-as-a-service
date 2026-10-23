import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/** Text that screen readers announce but the page does not show, such as a legend a heading already explains. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
