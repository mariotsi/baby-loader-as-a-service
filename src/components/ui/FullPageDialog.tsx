'use client';

import { type ReactNode, type SubmitEvent, useEffect, useId, useRef } from 'react';
import { Button } from './Button';
import styles from './FullPageDialog.module.css';

interface FullPageDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** The close button's label, for screen readers: "Close without saving". */
  closeLabel: string;
  /** Keeps the dialog open, and the close button and Escape quiet, while its action runs. */
  busy?: boolean;
  onClose: () => void;
  /** The dialog is a form: Enter in a field and its `type="submit"` action call this. */
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
  /** The dialog's actions, pinned to the bottom of the screen; the primary one last. */
  actions: ReactNode;
  /** How wide the content grows: `wide` leaves room for previews beside the fields. */
  width?: 'medium' | 'wide';
  children: ReactNode;
}

/**
 * A modal that takes the whole screen for one step that changes a lot at
 * once, like announcing the birth. It focuses its first field, scrolls its
 * content between a fixed heading and fixed actions, and returns focus to its
 * trigger when it closes.
 */
export function FullPageDialog({
  open,
  title,
  description,
  closeLabel,
  busy = false,
  onClose,
  onSubmit,
  actions,
  width = 'medium',
  children,
}: FullPageDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      body.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    } else if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-width={width}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
    >
      {open ? (
        <form className={styles.frame} onSubmit={onSubmit} noValidate>
          <header className={styles.header}>
            <div className={styles.heading}>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className={styles.description}>
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" icon="x" labelHidden onClick={() => !busy && onClose()}>
              {closeLabel}
            </Button>
          </header>
          <div ref={body} className={styles.body}>
            <div className={styles.content}>{children}</div>
          </div>
          <footer className={styles.footer}>
            <div className={styles.actions}>{actions}</div>
          </footer>
        </form>
      ) : null}
    </dialog>
  );
}
