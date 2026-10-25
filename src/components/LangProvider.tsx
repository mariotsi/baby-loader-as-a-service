'use client';

import { createContext, type ReactNode, use } from 'react';
import type { Lang } from '@/lib/i18n';

const LangContext = createContext<Lang>('en');

/**
 * Hands the Platform's language, negotiated on the server, to every Client
 * Component below it. Copy stays in the dictionaries: a component reads its
 * own with `useLang()`, as in `platformCopy[useLang()]`, since a dictionary's
 * functions cannot cross from the server as props.
 */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext value={lang}>{children}</LangContext>;
}

export function useLang(): Lang {
  return use(LangContext);
}
