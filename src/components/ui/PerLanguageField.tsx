'use client';

import { type ReactNode, useId } from 'react';
import { useLang } from '@/components/LangProvider';
import { uiCopy } from '@/lib/copy/ui';
import { inPlatformOrder, type Lang, languageName } from '@/lib/i18n';
import { Badge } from './Badge';
import { Field } from './Field';
import styles from './PerLanguageField.module.css';

/** What the render for one Language gets: its Language, its text, and how to change that text. */
export interface LanguageControl {
  lang: Lang;
  value: string;
  onChange: (text: string) => void;
}

interface PerLanguageFieldProps {
  label: ReactNode;
  /**
   * With one Language, gives the label to screen readers only. With more, the
   * label names the group of controls and stays in view.
   */
  labelHidden?: boolean;
  /** The Languages to ask for: one control each, in the Platform's order. */
  languages: readonly Lang[];
  /** The text in each Language. A Language missing here starts empty. */
  value: Partial<Record<Lang, string>>;
  /** Called with the Language whose text changed, and its new text. */
  onChange: (lang: Lang, text: string) => void;
  /** What is wrong in each Language. Each one marks its control invalid. */
  errors?: Partial<Record<Lang, ReactNode>>;
  hint?: ReactNode;
  optional?: boolean;
  /**
   * Draws the control for one Language from its text: one control, like an
   * `Input` or a `Textarea`, which the Field around it labels and ties to
   * its error.
   */
  children: (control: LanguageControl) => ReactNode;
}

/**
 * A text per Language, all asked for at once so none is forgotten. With one
 * Language it is a plain `Field` that never mentions Languages; with more, a
 * group with a control per Language, each beside a short tag ("IT") that
 * screen readers hear in full ("Italian"). It holds the texts by Language
 * and lays out and labels the controls; which control draws each text is up
 * to `children`.
 */
export function PerLanguageField({
  label,
  labelHidden = false,
  languages,
  value,
  onChange,
  errors = {},
  hint,
  optional,
  children,
}: PerLanguageFieldProps) {
  const pageLang = useLang();
  const hintId = useId();
  const ordered = inPlatformOrder(languages);

  function control(lang: Lang) {
    return children({ lang, value: value[lang] ?? '', onChange: (text) => onChange(lang, text) });
  }

  if (ordered.length === 1) {
    const [lang] = ordered;
    return (
      <Field label={label} labelHidden={labelHidden} hint={hint} error={errors[lang]} optional={optional}>
        {control(lang)}
      </Field>
    );
  }

  return (
    <fieldset className={styles.root} aria-describedby={hint ? hintId : undefined}>
      <legend className={styles.legend}>
        {label}
        {optional ? <Badge size="sm"> {uiCopy[pageLang].optional}</Badge> : null}
      </legend>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      <div className={styles.controls}>
        {ordered.map((lang) => (
          <div key={lang} className={styles.row}>
            <span className={styles.tag} aria-hidden="true">
              {lang.toUpperCase()}
            </span>
            <Field label={languageName(lang, pageLang)} labelHidden error={errors[lang]}>
              {control(lang)}
            </Field>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
