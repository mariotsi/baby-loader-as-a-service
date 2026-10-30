import type { ReactNode } from 'react';
import styles from './Badge.module.css';
import { Icon, type IconName } from './Icon';

interface BadgeProps {
  /** `highlight` marks something special, like a recommended choice; `neutral` notes a plain fact, like "optional". */
  tone?: 'neutral' | 'highlight';
  /** `plain` is sentence-case text that inherits its label's color and size. */
  variant?: 'outlined' | 'plain';
  /** `sm` sits inside a line of text, like a field's label. */
  size?: 'md' | 'sm';
  icon?: IconName;
  children: ReactNode;
}

/** A small, non-interactive label for a status or property of something beside it. */
export function Badge({ tone = 'neutral', size = 'md', variant = 'outlined', icon, children }: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[tone], size === 'sm' && styles.sm, variant === 'plain' && styles.plain]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? <Icon name={icon} className={styles.icon} /> : null}
      {children}
    </span>
  );
}
