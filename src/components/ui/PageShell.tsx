import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { JoyBackground } from './JoyBackground';
import styles from './PageShell.module.css';

interface PageShellProps {
  /** How wide the content grows on a large screen: `narrow` for a sign-in card, `medium` for a form, `wide` for lists. */
  width?: 'narrow' | 'medium' | 'wide';
  /** Links on the right of the header, like the way back to the Dashboard. */
  nav?: ReactNode;
  children: ReactNode;
}

/**
 * The frame of every Platform page: the wordmark, the page's links, the
 * playful circles behind it and one `<main>` for the content. A Public page
 * has its own frame.
 */
export function PageShell({ width = 'medium', nav, children }: PageShellProps) {
  return (
    <div className={styles.page}>
      <JoyBackground />
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          <Icon name="heart" className={styles.heart} />
          Waiting Pages
        </Link>
        {nav ? <nav className={styles.nav}>{nav}</nav> : null}
      </header>
      <main className={`${styles.main} ${styles[width]}`}>{children}</main>
    </div>
  );
}
