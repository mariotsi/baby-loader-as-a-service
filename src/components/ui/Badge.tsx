import type { ReactNode } from 'react';
import styles from './Badge.module.css';
import { Icon, type IconName } from './Icon';

interface BadgeProps {
  /** `highlight` marks something special, like a recommended choice; `neutral` notes a plain fact, like "optional". */
  tone?: 'neutral' | 'highlight';
  /** `sm` sits inside a line of text, like a field's label. */
  size?: 'md' | 'sm';
  icon?: IconName;
  children: ReactNode;
}

/**
 * A small label for a status or a property of something next to it. It is
 * never pressed, so it never looks like a Button: it takes no accent color,
 * only the Palette's decoration colors and the text colors, in small capitals
 * with square-ish corners, and has no hover or focus state.
 */
export function Badge({ tone = 'neutral', size = 'md', icon, children }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[tone], size === 'sm' && styles.sm].filter(Boolean).join(' ')}>
      {icon ? <Icon name={icon} className={styles.icon} /> : null}
      {children}
    </span>
  );
}
