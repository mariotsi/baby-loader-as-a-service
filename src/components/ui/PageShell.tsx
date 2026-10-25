import Link from 'next/link';
import type { ReactNode } from 'react';
import { PlatformLanguageSwitcher } from '@/components/PlatformLanguageSwitcher';
import { JoyBackground } from './JoyBackground';
import { Logo } from './Logo';
import styles from './PageShell.module.css';

interface PageShellProps {
  /** How wide the content grows on a large screen: `narrow` for a sign-in card, `medium` for a form, `wide` for lists. */
  width?: 'narrow' | 'medium' | 'wide';
  /** Links on the right of the header, like the way back to the Dashboard. */
  nav?: ReactNode;
  children: ReactNode;
}

/**
 * The frame of every Platform page: the Logo, the page's links, the Language
 * switcher, the playful circles behind it and one `<main>` for the content. A
 * Public page has its own frame.
 */
export function PageShell({ width = 'medium', nav, children }: PageShellProps) {
  return (
    <div className={styles.page}>
      <JoyBackground />
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          <Logo />
        </Link>
        <div className={styles.end}>
          {nav ? <nav className={styles.nav}>{nav}</nav> : null}
          <PlatformLanguageSwitcher />
        </div>
      </header>
      <main className={`${styles.main} ${styles[width]}`}>{children}</main>
    </div>
  );
}
