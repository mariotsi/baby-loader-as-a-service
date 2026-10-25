'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import styles from './Combobox.module.css';
import controlStyles from './control.module.css';
import { useFieldControlProps } from './Field';
import { Icon } from './Icon';
import { Spinner } from './Spinner';
import { VisuallyHidden } from './VisuallyHidden';

interface ComboboxProps<T> {
  /** The text in the control. */
  value: string;
  onValueChange: (value: string) => void;
  /**
   * The suggestions for the text, found by the caller. The list opens on
   * them as the person types or presses the down arrow, and closes when the
   * control loses focus.
   */
  options: readonly T[];
  /** Unique among `options`. */
  getOptionKey: (option: T) => string;
  /** What an option says. */
  renderOption: (option: T) => ReactNode;
  /** Called when the person picks an option with Enter, a click or a tap. The list then closes. */
  onSelect: (option: T) => void;
  /** Shows the Spinner in the control while the caller looks for suggestions. */
  loading?: boolean;
  /**
   * What the search came to, in words: "3 places found", "No places match",
   * "Search is unavailable right now". The list shows it under the options,
   * and screen readers hear it as it changes.
   */
  status?: ReactNode;
  /** The list's name for screen readers: "Places". */
  listLabel: string;
  /**
   * Shows a button that empties the control while it holds text: `label` is
   * its name for screen readers ("Remove the place"), `onClear` runs when it
   * is pressed.
   */
  clear?: { label: string; onClear: () => void };
  placeholder?: string;
  /** Required when the Combobox is not in a `Field`. */
  'aria-label'?: string;
  className?: string;
}

/**
 * A text control that suggests what to pick as the person types, like a
 * Place's address. The caller finds the options and owns the text: the
 * Combobox shows them, moves through them with the arrow keys, picks one
 * with Enter or a tap, and closes with Escape, as the ARIA combobox pattern
 * does. Put it in a `Field`, or give it an `aria-label`.
 */
export function Combobox<T>({
  value,
  onValueChange,
  options,
  getOptionKey,
  renderOption,
  onSelect,
  loading = false,
  status,
  listLabel,
  clear,
  placeholder,
  'aria-label': ariaLabel,
  className,
}: ComboboxProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const control = useFieldControlProps({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // A new list of options is a new search: nothing is highlighted until the person moves to one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each new list of options.
  useEffect(() => setActive(-1), [options]);

  useEffect(() => {
    if (active >= 0) {
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, id]);

  const shown = open && (options.length > 0 || !!status);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function pick(option: T) {
    onSelect(option);
    close();
  }

  function move(step: 1 | -1) {
    setOpen(true);
    if (!shown || options.length === 0) {
      return;
    }
    setActive((current) => {
      if (current < 0) {
        return step > 0 ? 0 : options.length - 1;
      }
      return (current + step + options.length) % options.length;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        move(event.key === 'ArrowDown' ? 1 : -1);
        break;
      case 'Enter': {
        const option = shown && active >= 0 ? options[active] : undefined;
        if (option !== undefined) {
          // Picks the option and keeps the form from submitting.
          event.preventDefault();
          pick(option);
        }
        break;
      }
      case 'Escape':
        if (shown) {
          event.preventDefault();
          close();
        }
        break;
    }
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <input
        {...control}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
        className={[controlStyles.control, styles.control].join(' ')}
      />
      <span className={styles.end}>
        {loading ? <Spinner /> : null}
        {clear && value ? (
          <button
            type="button"
            className={styles.clear}
            aria-label={clear.label}
            onClick={() => {
              clear.onClear();
              inputRef.current?.focus();
            }}
          >
            <Icon name="x" />
          </button>
        ) : null}
      </span>
      <div className={styles.popup} hidden={!shown}>
        <div id={listId} role="listbox" aria-label={listLabel} aria-busy={loading || undefined} className={styles.list}>
          {options.map((option, index) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard picks an option through the control's onKeyDown, where the focus stays.
            <div
              key={getOptionKey(option)}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Reachable by the arrow keys in the control, never by Tab.
              tabIndex={-1}
              className={styles.option}
              // Keeps the focus in the control, so its blur does not close the list before the click lands.
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => setActive(index)}
              onClick={() => pick(option)}
            >
              {renderOption(option)}
            </div>
          ))}
        </div>
        {status ? <p className={styles.status}>{status}</p> : null}
      </div>
      <VisuallyHidden>
        <span role="status">{open ? status : null}</span>
      </VisuallyHidden>
    </div>
  );
}
