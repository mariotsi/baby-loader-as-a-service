'use client';

import {
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
  EmojiPicker as Frimousse,
} from 'frimousse';
import { useEffect, useId, useRef, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { uiCopy } from '@/lib/copy/ui';
import { TWEMOJI_EMOJI_VERSION, twemojiUrl } from '@/lib/siteAppIdentity';
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

/** Frimousse reads an Emoji version from the Emojibase release of that number, and Emojibase has no release 14. */
const EMOJIBASE_URL = 'https://cdn.jsdelivr.net/npm/emojibase-data@18.0.0';

/**
 * Picks one emoji: a button showing the current one opens a searchable grid
 * under it. Emoji show in Twemoji, the set the Site's generated images and the
 * editor's previews draw, and the grid offers only those Twemoji has. Picking
 * an emoji, Escape or a press outside closes the grid and gives the focus back
 * to the button.
 */
export function EmojiPicker({ value, onChange, label }: EmojiPickerProps) {
  const t = uiCopy[useLang()].emoji;
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
        <EmojiImage key={value} emoji={value} />
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          <Frimousse.Root
            className={styles.picker}
            columns={COLUMNS}
            emojiVersion={TWEMOJI_EMOJI_VERSION}
            emojibaseUrl={EMOJIBASE_URL}
            onEmojiSelect={({ emoji }) => {
              onChange(emoji);
              close();
            }}
          >
            <Frimousse.Search
              className={control.control}
              aria-label={t.search}
              placeholder={t.searchPlaceholder}
              autoFocus
            />
            <Frimousse.Viewport className={styles.viewport}>
              <Frimousse.Loading className={styles.note}>{t.loading}</Frimousse.Loading>
              <Frimousse.Empty className={styles.note}>{t.empty}</Frimousse.Empty>
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
      <EmojiImage key={emoji.emoji} emoji={emoji.emoji} />
    </button>
  );
}

/** Keyed by its emoji, so a reused cell never shows the previous image. The device's font takes over when the image fails. */
function EmojiImage({ emoji }: { emoji: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span aria-hidden="true">{emoji}</span>;
  }
  // biome-ignore lint/performance/noImgElement: a remote Twemoji, shown small; next/image adds nothing.
  return <img className={styles.image} src={twemojiUrl(emoji)} alt="" onError={() => setFailed(true)} />;
}
