'use client';

import { useId, useState } from 'react';
import { englishName, inPlatformOrder, LANGS, type Lang } from '@/lib/i18n';
import { messages } from '@/lib/messages';
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
export function LanguagesPicker({ value, onChange, legend = 'Languages' }: LanguagesPickerProps) {
  const hintId = useId();
  const [note, setNote] = useState<string | null>(null);

  function toggle(lang: Lang, checked: boolean) {
    if (!checked && value.length === 1) {
      setNote('Your page needs at least one language.');
      return;
    }
    onChange(inPlatformOrder(checked ? [...value, lang] : value.filter((l) => l !== lang)));
    setNote(null);
  }

  return (
    <fieldset className={styles.root} aria-describedby={hintId}>
      <legend className={styles.legend}>{legend}</legend>
      <p id={hintId} className={styles.hint}>
        Tick every language your page speaks. You write your page's words in each of them: your Page name, Milestones
        and Birth message get a box per language. Visitors get the one their browser asks for, or English if your page
        has it, and can switch.
      </p>
      <ul className={styles.options}>
        {LANGS.map((lang) => {
          const name = englishName(lang);
          const native = messages[lang].languageName;
          return (
            <li key={lang}>
              <Checkbox
                label={
                  <>
                    {name}
                    {native === name ? null : (
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
