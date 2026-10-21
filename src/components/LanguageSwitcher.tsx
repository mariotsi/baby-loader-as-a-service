'use client';

import type { Lang } from '@/lib/i18n';

export function LanguageSwitcher({
  langs,
  current,
  onChange,
}: {
  langs: Lang[];
  current: Lang;
  onChange: (lang: Lang) => void;
}) {
  return (
    <div className="row" style={{ justifyContent: 'center' }}>
      {langs.map((lang) => (
        <button
          type="button"
          key={lang}
          className="btn-secondary"
          aria-pressed={lang === current}
          style={{
            border: 'none',
            background: 'none',
            fontWeight: lang === current ? 700 : 400,
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            cursor: 'pointer',
            color: 'var(--fg)',
          }}
          onClick={() => onChange(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
