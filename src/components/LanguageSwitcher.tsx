'use client';

import { useRouter } from 'next/navigation';
import { LANG_COOKIE, LANGS, type Lang } from '@/lib/i18n';

export function LanguageSwitcher({ current }: { current: Lang }) {
  const router = useRouter();

  function setLang(lang: Lang) {
    // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing from Safari before 18.4, which Visitors still use.
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      {LANGS.map((lang) => (
        <button
          type="button"
          key={lang}
          className="btn-secondary"
          style={{
            border: 'none',
            background: 'none',
            fontWeight: lang === current ? 700 : 400,
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: 'var(--fg)',
          }}
          onClick={() => setLang(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
