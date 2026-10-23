'use client';

import { createContext, type ReactNode, useContext, useId } from 'react';
import styles from './Field.module.css';
import { Icon } from './Icon';

/** What a Field tells the control inside it, so the label, hint and error reach assistive technology. */
interface FieldControl {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

/** The props a control inside a Field takes from it; a prop the caller passes wins. */
export function useFieldControlProps<P extends { id?: string; required?: boolean; 'aria-describedby'?: string }>(
  props: P
) {
  const field = useContext(FieldContext);
  if (!field) {
    return props;
  }
  const describedBy = [field.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return {
    ...props,
    id: props.id ?? field.id,
    required: props.required ?? field.required,
    'aria-describedby': describedBy,
    'aria-invalid': field.invalid || undefined,
  };
}

interface FieldProps {
  label: ReactNode;
  /** Help under the control. Keep it short and kind. */
  hint?: ReactNode;
  /** What is wrong and how to fix it. Marks the control invalid. */
  error?: ReactNode;
  required?: boolean;
  /** Says "optional" next to the label. Mark the optional fields, not the required ones. */
  optional?: boolean;
  /** Announces the hint and the error as they change while the person types, as for a live preview of the Address. */
  liveHint?: boolean;
  /** One control: `Input`, `Textarea` or `Select`. */
  children: ReactNode;
  className?: string;
}

/**
 * A labelled form control with its hint and error. It generates the
 * control's id, so a Field never needs a hand-written one and stays unique
 * when it renders twice.
 */
export function Field({ label, hint, error, required = false, optional, liveHint, children, className }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional ? <span className={styles.optional}> optional</span> : null}
      </label>
      <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required }}>{children}</FieldContext.Provider>
      {/* A live region must exist before its content changes, so a live one renders even while empty. */}
      {liveHint || error || hint ? (
        <div className={styles.messages} aria-live={liveHint ? 'polite' : undefined}>
          {error ? (
            <p id={errorId} className={styles.error}>
              <Icon name="alert" className={styles.errorIcon} />
              <span>{error}</span>
            </p>
          ) : null}
          {hint ? (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
