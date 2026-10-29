import type { ComponentProps } from 'react';
import styles from './ExternalLink.module.css';
import { Icon } from './Icon';

/** An external destination, marked with an icon and opened in a new tab by default. */
export function ExternalLink({
  children,
  target = '_blank',
  rel = 'noopener noreferrer',
  className,
  ...props
}: ComponentProps<'a'>) {
  return (
    <a {...props} target={target} rel={rel} className={[styles.link, className].filter(Boolean).join(' ')}>
      {children} <Icon name="external" className={styles.icon} />
    </a>
  );
}
