'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { commonCopy } from '@/lib/copy/common';
import { LANG_COOKIE, type Lang } from '@/lib/i18n';

/** Writes the language cookie, so the next visit to this host opens in `lang`. */
export function rememberLang(lang: Lang) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from Safari before 18.4, which Visitors still use.
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The Language switcher, on a Public page with more than one Language and on
 * every Platform page (see PlatformLanguageSwitcher): short codes on screen,
 * and for screen readers each language named in itself, so a reader finds
 * their own whichever language the page is in.
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
            <VisuallyHidden>{commonCopy[lang].languageName}</VisuallyHidden>
          </span>
        ),
      }))}
    />
  );
}
