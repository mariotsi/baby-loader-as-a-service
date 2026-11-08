'use client';

import { useEffect, useRef, useState } from 'react';
import { freeHold, isHeld, jumpHold } from '@/lib/sectionNavHold';
import { Icon } from './Icon';
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
 * of chips that scrolls sideways, and a column on a wide screen. A row that
 * holds more than it shows fades out at that edge, with an arrow, leaving a
 * chip cut in two. A link glides the page to its section, and jumps under
 * `prefers-reduced-motion`.
 */
export function SectionNav({ label, sections, className }: SectionNavProps) {
  const [current, setCurrent] = useState(sections[0]?.id);
  const [more, setMore] = useState({ start: false, end: false });
  const list = useRef<HTMLUListElement>(null);
  /** A jump in progress holds the mark; see `jumpHold`. */
  const hold = useRef(freeHold);
  const settling = useRef(0);
  const ids = sections.map((section) => section.id).join(' ');

  useEffect(() => {
    // The band a fifth of the way down the screen: the section crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries.find((entry) => entry.isIntersecting);
        if (entered && !isHeld(hold.current)) {
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

  useEffect(() => {
    const row = list.current;
    if (!row) {
      return;
    }
    function measure() {
      if (row) {
        const hidden = row.scrollWidth - row.clientWidth;
        setMore({ start: row.scrollLeft > 1, end: row.scrollLeft < hidden - 1 });
      }
    }
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    const resized = new ResizeObserver(measure);
    resized.observe(row);
    return () => {
      row.removeEventListener('scroll', measure);
      resized.disconnect();
    };
  }, []);

  // In a row, the marked chip stays in view as the page scrolls.
  useEffect(() => {
    const row = list.current;
    const chip = Array.from(row?.querySelectorAll('a') ?? []).find((link) => link.hash === `#${current}`);
    if (row && chip && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2 });
    }
  }, [current]);

  useEffect(() => {
    // Without scrollend, a spell with no scroll ends the jump.
    const hasScrollend = 'onscrollend' in window;
    let quiet = 0;
    function onScroll() {
      hold.current = jumpHold(hold.current, 'scroll');
      if (!hasScrollend) {
        window.clearTimeout(quiet);
        quiet = window.setTimeout(onScrollend, 150);
      }
    }
    function onScrollend() {
      hold.current = jumpHold(hold.current, 'scrollend');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollend);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollend);
      window.clearTimeout(quiet);
      cancelAnimationFrame(settling.current);
    };
  }, []);

  function startJump() {
    hold.current = jumpHold(hold.current, 'click');
    // A click on a section already in place scrolls nothing: two frames on, a jump that never moved lets go.
    cancelAnimationFrame(settling.current);
    settling.current = requestAnimationFrame(() => {
      settling.current = requestAnimationFrame(() => {
        hold.current = jumpHold(hold.current, 'settle');
      });
    });
  }

  return (
    <nav aria-label={label} className={className}>
      <div className={styles.row}>
        <ul
          ref={list}
          className={[styles.list, more.start && styles.fadeStart, more.end && styles.fadeEnd]
            .filter(Boolean)
            .join(' ')}
        >
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={styles.link}
                data-label={section.label}
                aria-current={section.id === current ? 'location' : undefined}
                onClick={() => {
                  startJump();
                  setCurrent(section.id);
                }}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
        {more.start ? (
          <span className={`${styles.more} ${styles.moreStart}`}>
            <Icon name="arrow-right" />
          </span>
        ) : null}
        {more.end ? (
          <span className={`${styles.more} ${styles.moreEnd}`}>
            <Icon name="arrow-right" />
          </span>
        ) : null}
      </div>
    </nav>
  );
}
