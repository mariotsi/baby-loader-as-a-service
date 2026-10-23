'use client';

import { useId, useState } from 'react';
import { englishName, LANGS, type Lang } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { Badge } from './Badge';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Icon } from './Icon';
import styles from './LanguagesPicker.module.css';

interface LanguagesPickerProps {
  /** The Site's Languages, the main one first. */
  value: Lang[];
  onChange: (languages: Lang[]) => void;
  legend?: string;
}

/**
 * Picks a Site's Languages: a checkbox per supported language, in the order
 * `LANGS` lists them. The first Language is the main one, which a Visitor
 * gets when their browser speaks none of them. Ticking adds a language after
 * the others, and "Make main" moves one to the front. The last Language
 * stays ticked, with a note saying why.
 */
export function LanguagesPicker({ value, onChange, legend = 'Languages' }: LanguagesPickerProps) {
  const hintId = useId();
  const [note, setNote] = useState<string | null>(null);

  function toggle(lang: Lang, checked: boolean) {
    if (checked) {
      onChange([...value, lang]);
      setNote(null);
      return;
    }
    if (value.length === 1) {
      setNote('Your page needs at least one language.');
      return;
    }
    onChange(value.filter((l) => l !== lang));
    setNote(null);
  }

  return (
    <fieldset className={styles.root} aria-describedby={hintId}>
      <legend className={styles.legend}>{legend}</legend>
      <p id={hintId} className={styles.hint}>
        Tick every language your page speaks. You write your page's words in each of them: your Birth message gets a box
        per language. Visitors switch between them, and the main one{' '}
        <span aria-hidden="true">
          (<Icon name="star" className={styles.hintStar} />)
        </span>
        opens for anyone whose browser speaks none.
      </p>
      <ul className={styles.options}>
        {LANGS.map((lang) => {
          const name = englishName(lang);
          const native = messages[lang].languageName;
          const checked = value.includes(lang);
          const main = value.length > 1 && value[0] === lang;
          return (
            <li key={lang} className={styles.option}>
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
                checked={checked}
                onChange={(e) => toggle(lang, e.target.checked)}
              />
              {main ? (
                <Badge tone="highlight" icon="star">
                  <span className={styles.badgeText}>Main language</span>
                </Badge>
              ) : null}
              {checked && value.length > 1 && !main ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Make main: ${name}`}
                  onClick={() => onChange([lang, ...value.filter((l) => l !== lang)])}
                >
                  Make main
                </Button>
              ) : null}
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
