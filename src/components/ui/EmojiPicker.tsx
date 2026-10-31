'use client';

import {
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
  EmojiPicker as Frimousse,
} from 'frimousse';
import { type CSSProperties, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
  /**
   * Shows emoji in Twemoji and offers only those Twemoji has, for an emoji that
   * ends up in the Site's generated images. Without it emoji show in the
   * device's font, as text on a page does.
   */
  twemoji?: boolean;
}

/** Six columns of 44px emoji fit a 320px screen beside the page's gutters. */
const COLUMNS = 6;

/** Frimousse reads an Emoji version from the Emojibase release of that number, and Emojibase has no release 14. */
const EMOJIBASE_URL = 'https://cdn.jsdelivr.net/npm/emojibase-data@18.0.0';

/** The room the panel keeps from the viewport's edges, in pixels. */
const VIEWPORT_MARGIN = 8;

/** The shortest the emoji grid gets on a screen with little room, in pixels. */
const MIN_GRID_HEIGHT = 200;

interface Placement {
  above: boolean;
  /** The panel's end lines up with the button's, for a button near the right edge. */
  end: boolean;
  /** Set when neither side has room for the whole grid. */
  gridHeight?: number;
}

/** Below the button unless the panel only fits above, or there is more room above. */
function placePanel(button: DOMRect, panel: DOMRect, grid: DOMRect): Placement {
  const below = window.innerHeight - button.bottom - VIEWPORT_MARGIN;
  const above = button.top - VIEWPORT_MARGIN;
  const opensAbove = below < panel.height && above > below;
  const room = opensAbove ? above : below;
  const end = button.left + panel.width > window.innerWidth - VIEWPORT_MARGIN;
  if (room >= panel.height) {
    return { above: opensAbove, end };
  }
  return { above: opensAbove, end, gridHeight: Math.max(MIN_GRID_HEIGHT, room - (panel.height - grid.height)) };
}

/**
 * Picks one emoji: a button showing the current one opens a searchable grid
 * on the side of it with room. Picking an emoji, Escape or a press outside
 * closes the grid and gives the focus back to the button.
 */
export function EmojiPicker({ value, onChange, label, twemoji = false }: EmojiPickerProps) {
  const t = uiCopy[useLang()].emoji;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement>({ above: false, end: false });

  // Before the paint, so the panel never shows on the wrong side first.
  useLayoutEffect(() => {
    const grid = panelRef.current?.firstElementChild;
    if (open && buttonRef.current && panelRef.current && grid) {
      setPlacement(
        placePanel(
          buttonRef.current.getBoundingClientRect(),
          panelRef.current.getBoundingClientRect(),
          grid.getBoundingClientRect()
        )
      );
    }
  }, [open]);

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
        {twemoji ? <EmojiImage key={value} emoji={value} /> : <span aria-hidden="true">{value}</span>}
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className={[styles.panel, placement.above && styles.above, placement.end && styles.end]
            .filter(Boolean)
            .join(' ')}
          style={placement.gridHeight ? ({ '--grid-height': `${placement.gridHeight}px` } as CSSProperties) : undefined}
        >
          <Frimousse.Root
            className={styles.picker}
            columns={COLUMNS}
            emojiVersion={twemoji ? TWEMOJI_EMOJI_VERSION : undefined}
            emojibaseUrl={twemoji ? EMOJIBASE_URL : undefined}
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
              <Frimousse.List components={{ CategoryHeader, Row, Emoji: twemoji ? TwemojiCell : DeviceCell }} />
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

function DeviceCell({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button {...props} type="button" className={styles.emoji} data-active={emoji.isActive || undefined}>
      {emoji.emoji}
    </button>
  );
}

function TwemojiCell({ emoji, ...props }: EmojiPickerListEmojiProps) {
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
