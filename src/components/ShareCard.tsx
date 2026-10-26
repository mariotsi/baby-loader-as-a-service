import type { ReactNode } from 'react';
import type { PublicPageView } from '@/lib/publicPageView';
import type { ColorTokens } from '@/lib/theme';

type ColorToken = Exclude<keyof ColorTokens, '--color-scheme'>;

export interface ShareCardProps {
  view: PublicPageView;
  /** The Site icon, filling a 280px rounded square on the Palette's soft color. */
  icon: ReactNode;
  /** A length in the image's 1200×630 pixels, as the renderer writes it. */
  px: (pixels: number) => number | string;
  color: (token: ColorToken) => string;
  /** Undefined leaves the typeface ImageResponse bundles. */
  font: { display: string | undefined; displayWeight: number | string; body: string | undefined };
}

/**
 * The share image's layout: the Site icon beside the Public page's headline
 * and Countdown. ImageResponse draws it at 1200×630 (see siteImages.tsx) and
 * the editor's link preview draws it scaled to its box, so the preview is the
 * image. Only inline styles and flex layout, which ImageResponse reads.
 */
export function ShareCard({ view, icon, px, color, font }: ShareCardProps) {
  const display = { fontFamily: font.display, fontWeight: font.displayWeight };
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: px(64),
        paddingLeft: px(88),
        paddingRight: px(88),
        background: color('--color-bg'),
        color: color('--color-text'),
        fontFamily: font.body,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: px(280),
          height: px(280),
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: px(64),
          overflow: 'hidden',
          background: color('--color-soft'),
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: px(12), minWidth: 0 }}>
        <div style={{ fontSize: px(34), color: color('--color-text-muted') }}>{view.tagline}</div>
        <div style={{ ...display, fontSize: px(64), lineHeight: 1.1, color: color('--color-accent-ink') }}>
          {view.title}
        </div>
        {view.sex ? <div style={{ ...display, fontSize: px(34) }}>{view.sex}</div> : null}
        {view.waiting ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(16) }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: px(16) }}>
              {view.waiting.count === null ? null : (
                <span style={{ ...display, fontSize: px(96), color: color('--color-accent-ink') }}>
                  {view.waiting.count}
                </span>
              )}
              <span style={{ fontSize: px(40) }}>{view.waiting.unit}</span>
            </div>
            <div style={{ fontSize: px(30), color: color('--color-text-muted') }}>{view.waiting.dueDate}</div>
          </div>
        ) : null}
        {view.born ? <div style={{ fontSize: px(36), marginTop: px(16) }}>{view.born.bornOn}</div> : null}
      </div>
    </div>
  );
}
