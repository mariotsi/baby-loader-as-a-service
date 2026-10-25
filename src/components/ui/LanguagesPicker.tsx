'use client';

import { useId, useState } from 'react';
import { useLang } from '@/components/LangProvider';
import { commonCopy } from '@/lib/copy/common';
import { uiCopy } from '@/lib/copy/ui';
import { inPlatformOrder, LANGS, type Lang, languageName } from '@/lib/i18n';
import { Checkbox } from './Checkbox';
import styles from './LanguagesPicker.module.css';

interface LanguagesPickerProps {
  value: Lang[];
  /** Gets the Languages in the Platform's order, whatever order they were ticked in. */
  onChange: (languages: Lang[]) => void;
  legend?: string;
}

/**
 * Picks a Site's Languages: a checkbox per supported language, in the order
 * `LANGS` lists them. The last Language stays ticked, with a note saying why.
 */
export function LanguagesPicker({ value, onChange, legend }: LanguagesPickerProps) {
  const pageLang = useLang();
  const t = uiCopy[pageLang].languages;
  const hintId = useId();
  const [note, setNote] = useState<string | null>(null);

  function toggle(lang: Lang, checked: boolean) {
    if (!checked && value.length === 1) {
      setNote(t.keepOne);
      return;
    }
    onChange(inPlatformOrder(checked ? [...value, lang] : value.filter((l) => l !== lang)));
    setNote(null);
  }

  return (
    <fieldset className={styles.root} aria-describedby={hintId}>
      <legend className={styles.legend}>{legend ?? t.legend}</legend>
      <p id={hintId} className={styles.hint}>
        {t.hint}
      </p>
      <ul className={styles.options}>
        {LANGS.map((lang) => {
          // Named in the page's language, then in itself when that differs: "Italian (Italiano)". Italian writes
          // language names in lowercase, so the label's first letter is raised and the two compare without case.
          const named = languageName(lang, pageLang);
          const name = named.charAt(0).toLocaleUpperCase(pageLang) + named.slice(1);
          const native = commonCopy[lang].languageName;
          return (
            <li key={lang}>
              <Checkbox
                label={
                  <>
                    {name}
                    {native.toLocaleLowerCase(lang) === named.toLocaleLowerCase(pageLang) ? null : (
                      <span lang={lang} className={styles.native}>
                        {' '}
                        ({native})
                      </span>
                    )}
                  </>
                }
                checked={value.includes(lang)}
                onChange={(e) => toggle(lang, e.target.checked)}
              />
            </li>
          );
        })}
      </ul>
      <p className={styles.note} aria-live="polite">
        {note}
      </p>
    </fieldset>
  );
}
