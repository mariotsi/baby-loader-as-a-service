'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { lookClassName } from './Button';
import { Icon } from './Icon';
import styles from './LinksMenu.module.css';

interface LinksMenuProps {
  /** Names the button, like "More". */
  label: string;
  links: { href: string; label: string }[];
  /** Placement only. */
  className?: string;
}

/**
 * A button that unfolds links to other pages, for actions that don't fit a
 * phone's line. A tap outside it or Escape folds it again.
 */
export function LinksMenu({ label, links, className }: LinksMenuProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function tapOutside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function pressEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menu.current?.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', tapOutside);
    document.addEventListener('keydown', pressEscape);
    return () => {
      document.removeEventListener('pointerdown', tapOutside);
      document.removeEventListener('keydown', pressEscape);
    };
  }, [open]);

  return (
    <details
      ref={menu}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={[styles.menu, className].filter(Boolean).join(' ')}
    >
      <summary className={lookClassName({ size: 'phoneSm' }, styles.summary)}>
        {label}
        <Icon name="chevron-down" className={styles.chevron} />
      </summary>
      <ul className={styles.links}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
