'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { useLang } from '@/components/LangProvider';
import { LanguageSwitcher, rememberLang } from '@/components/LanguageSwitcher';
import { commonCopy } from '@/lib/copy/common';
import { LANGS, type Lang } from '@/lib/i18n';

/**
 * The Language switcher of a Platform page, offering every language in
 * `LANGS`. A pick is written to the language cookie and the page is fetched
 * again, so Server Components render in it too; the switcher shows the pick
 * while that happens.
 */
export function PlatformLanguageSwitcher() {
  const lang = useLang();
  const router = useRouter();
  const [shown, showLang] = useOptimistic(lang);
  const [, startTransition] = useTransition();

  function choose(next: Lang) {
    rememberLang(next);
    startTransition(() => {
      showLang(next);
      router.refresh();
    });
  }

  return (
    <LanguageSwitcher langs={[...LANGS]} current={shown} label={commonCopy[shown].languageLabel} onChange={choose} />
  );
}
