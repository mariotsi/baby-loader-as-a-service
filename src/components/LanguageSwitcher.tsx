'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import type { Lang } from '@/lib/i18n';
import { messages } from '@/lib/messages';

/**
 * The Language switcher of a Public page with more than one Language: short
 * codes on screen, and for screen readers each language named in itself, so a
 * Visitor finds their own whichever language the page is in.
 */
export function LanguageSwitcher({
  langs,
  current,
  label,
  onChange,
}: {
  langs: Lang[];
  current: Lang;
  label: string;
  onChange: (lang: Lang) => void;
}) {
  return (
    <SegmentedControl
      legend={label}
      hideLegend
      size="sm"
      value={current}
      onChange={onChange}
      options={langs.map((lang) => ({
        value: lang,
        label: (
          <span lang={lang}>
            <span aria-hidden="true">{lang.toUpperCase()}</span>
            <VisuallyHidden>{messages[lang].languageName}</VisuallyHidden>
          </span>
        ),
      }))}
    />
  );
}
