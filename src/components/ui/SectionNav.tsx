'use client';

import { useEffect, useState } from 'react';
import styles from './SectionNav.module.css';

export interface NavSection {
  /** The `id` of the element the link jumps to. */
  id: string;
  label: string;
}

interface SectionNavProps {
  /** Names the navigation for screen readers. */
  label: string;
  sections: NavSection[];
  className?: string;
}

/**
 * Links to the sections of one long page, marking the section in view: a row
 * of chips that scrolls sideways, and a column on a wide screen.
 */
export function SectionNav({ label, sections, className }: SectionNavProps) {
  const [current, setCurrent] = useState(sections[0]?.id);
  const ids = sections.map((section) => section.id).join(' ');

  useEffect(() => {
    // The band a fifth of the way down the screen: the section crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries.find((entry) => entry.isIntersecting);
        if (entered) {
          setCurrent(entered.target.id);
        }
      },
      { rootMargin: '-20% 0px -75% 0px' }
    );
    for (const id of ids.split(' ')) {
      const section = document.getElementById(id);
      if (section) {
        observer.observe(section);
      }
    }
    return () => observer.disconnect();
  }, [ids]);

  return (
    <nav aria-label={label} className={className}>
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={styles.link}
              aria-current={section.id === current ? 'location' : undefined}
              onClick={() => setCurrent(section.id)}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
