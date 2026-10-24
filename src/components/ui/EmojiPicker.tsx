'use client';

import {
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
  EmojiPicker as Frimousse,
} from 'frimousse';
import { useEffect, useId, useRef, useState } from 'react';
import control from './control.module.css';
import styles from './EmojiPicker.module.css';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  /** Names the button, which shows only the emoji. */
  label: string;
}

/** Six columns of 44px emoji fit a 320px screen beside the page's gutters. */
const COLUMNS = 6;

/**
 * Picks one emoji: a button showing the current one opens a searchable grid
 * under it. Picking an emoji, Escape or a press outside
 * closes the grid and gives the focus back to the button.
 */
export function EmojiPicker({ value, onChange, label }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={`${label}: ${value}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{value}</span>
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          <Frimousse.Root
            className={styles.picker}
            columns={COLUMNS}
            onEmojiSelect={({ emoji }) => {
              onChange(emoji);
              close();
            }}
          >
            <Frimousse.Search className={control.control} aria-label="Search emoji" placeholder="Search" autoFocus />
            <Frimousse.Viewport className={styles.viewport}>
              <Frimousse.Loading className={styles.note}>Loading emoji…</Frimousse.Loading>
              <Frimousse.Empty className={styles.note}>No emoji found.</Frimousse.Empty>
              <Frimousse.List components={{ CategoryHeader, Row, Emoji }} />
            </Frimousse.Viewport>
          </Frimousse.Root>
        </div>
      ) : null}
    </div>
  );
}

function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div {...props} className={styles.category}>
      {category.label}
    </div>
  );
}

function Row({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div {...props} className={styles.row}>
      {children}
    </div>
  );
}

function Emoji({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button {...props} type="button" className={styles.emoji} data-active={emoji.isActive || undefined}>
      {emoji.emoji}
    </button>
  );
}
