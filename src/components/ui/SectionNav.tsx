'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import styles from './SectionNav.module.css';

/**
 * Frames the page holds still before a jump counts as over. Counted in frames, not time: a busy main thread stalls the
 * frames along with the scroll events while the glide runs on, and a timer would end the jump halfway.
 */
const JUMP_SETTLE_FRAMES = 15;

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
  /** The section being jumped to, until the page rests: the glide crosses others, and the last ones never reach the band. */
  const jumped = useRef<string | null>(null);
  const jumpFrame = useRef(0);
  const ids = sections.map((section) => section.id).join(' ');

  useEffect(() => {
    // The band a fifth of the way down the screen: the section crossing it is the one being read.
    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries.find((entry) => entry.isIntersecting);
        if (entered && !jumped.current) {
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

  useEffect(() => () => cancelAnimationFrame(jumpFrame.current), []);

  function jumpTo(id: string) {
    cancelAnimationFrame(jumpFrame.current);
    jumped.current = id;
    setCurrent(id);

    let top = window.scrollY;
    let stillFrames = 0;
    function watch() {
      stillFrames = window.scrollY === top ? stillFrames + 1 : 0;
      top = window.scrollY;
      if (stillFrames < JUMP_SETTLE_FRAMES) {
        jumpFrame.current = requestAnimationFrame(watch);
      } else {
        jumped.current = null;
      }
    }
    jumpFrame.current = requestAnimationFrame(watch);
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
                onClick={() => jumpTo(section.id)}
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
