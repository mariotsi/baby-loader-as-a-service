import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import styles from './StatusMessage.module.css';

type Tone = 'success' | 'danger' | 'info';

const ICONS: Record<Tone, IconName> = { success: 'circle-check', danger: 'alert', info: 'info' };

interface StatusMessageProps {
  tone: Tone;
  /** The message, or nothing while there is none to show. */
  children?: ReactNode;
  className?: string;
}

/**
 * The outcome of an action, like "Saved" after the Site settings are sent.
 * The live region renders even while empty, so a screen reader announces the
 * message the moment it appears: keep it mounted and change its children.
 * A `danger` message interrupts; the others wait for a pause.
 */
export function StatusMessage({ tone, children, className }: StatusMessageProps) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={className}>
      {children ? (
        <p className={[styles.message, styles[tone]].join(' ')}>
          <Icon name={ICONS[tone]} className={styles.icon} />
          <span>{children}</span>
        </p>
      ) : null}
    </div>
  );
}
