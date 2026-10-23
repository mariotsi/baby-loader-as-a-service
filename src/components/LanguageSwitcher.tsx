'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import type { Lang } from '@/lib/i18n';

/** Each language named in itself, so a Visitor finds their own whichever language the page is in. */
const NAMES: Record<Lang, string> = { it: 'Italiano', en: 'English' };

/** The Language switcher of a Public page in Both mode: short codes on screen, full names for screen readers. */
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
            <VisuallyHidden>{NAMES[lang]}</VisuallyHidden>
          </span>
        ),
      }))}
    />
  );
}
