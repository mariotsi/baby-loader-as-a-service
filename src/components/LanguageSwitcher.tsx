'use client';

import { useRouter } from 'next/navigation';
import { LANGS, LANG_COOKIE, type Lang } from '@/lib/i18n';

export function LanguageSwitcher({ current }: { current: Lang }) {
  const router = useRouter();

  function setLang(lang: Lang) {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      {LANGS.map((lang) => (
        <button
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
