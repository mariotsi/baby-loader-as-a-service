import type { ReactNode } from 'react';
import type { PublicPageView } from '@/lib/publicPageView';
import type { ColorTokens } from '@/lib/theme';

type ColorToken = Exclude<keyof ColorTokens, '--color-scheme'>;

export interface ShareCardProps {
  view: PublicPageView;
  /** The Site's Address, such as `https://christian.loading.baby`, in a pill at the bottom. */
  address: string;
  /** The Site icon, inside a 340px rounded tile on the Palette's surface color. */
  icon: ReactNode;
  /** A length in the image's 1200×630 pixels, as the renderer writes it. */
  px: (pixels: number) => number | string;
  color: (token: ColorToken) => string;
  /** Undefined leaves the typeface ImageResponse bundles. */
  font: { display: string | undefined; displayWeight: number | string; body: string | undefined };
}

/**
 * The share image's layout: the Site icon on a raised tile beside the Public
 * page's headline and Countdown, with three circles of the Palette's joy
 * colors in the corners, as the Platform's own share image has. ImageResponse
 * draws it at 1200×630 (see siteImages.tsx) and the editor's link preview
 * draws it scaled to its box, so the preview is the image. Only inline styles,
 * flex layout and absolute positions, which ImageResponse reads.
 */
export function ShareCard({ view, address, icon, px, color, font }: ShareCardProps) {
  const display = { fontFamily: font.display, fontWeight: font.displayWeight };
  const length = (pixels: number) => {
    const value = px(pixels);
    return typeof value === 'number' ? `${value}px` : value;
  };
  const circle = (left: number, top: number, size: number, token: ColorToken) => (
    <div
      style={{
        position: 'absolute',
        left: px(left),
        top: px(top),
        width: px(size),
        height: px(size),
        borderRadius: '50%',
        background: color(token),
      }}
    />
  );
  return (
    <div
      style={{
        position: 'relative',
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
      {circle(800, -290, 660, '--color-joy-1')}
      {circle(1000, 490, 300, '--color-joy-3')}
      {circle(-60, 520, 180, '--color-joy-2')}
      <div
        style={{
          width: px(340),
          height: px(340),
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: px(72),
          overflow: 'hidden',
          background: color('--color-surface'),
          boxShadow: `0 ${length(4)} ${length(8)} rgba(0, 0, 0, 0.05), 0 ${length(24)} ${length(60)} rgba(0, 0, 0, 0.12)`,
        }}
      >
        {icon}
      </div>
      <div
        style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: px(12), minWidth: 0 }}
      >
        <div style={{ fontSize: px(34), color: color('--color-text-muted') }}>{view.tagline}</div>
        <div style={{ ...display, fontSize: px(64), lineHeight: 1.1, color: color('--color-accent-ink') }}>
          {view.title}
        </div>
        {view.sex ? <div style={{ ...display, fontSize: px(34) }}>{view.sex}</div> : null}
        {view.waiting ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: px(16) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: px(20) }}>
              {view.waiting.count === null ? null : (
                <span style={{ ...display, fontSize: px(96), lineHeight: 1, color: color('--color-accent-ink') }}>
                  {view.waiting.count}
                </span>
              )}
              <span style={{ fontSize: px(40), lineHeight: 1 }}>{view.waiting.unit}</span>
            </div>
            <div style={{ fontSize: px(30), marginTop: px(12), color: color('--color-text-muted') }}>
              {view.waiting.dueDate}
            </div>
          </div>
        ) : null}
        {view.born ? <div style={{ fontSize: px(36), marginTop: px(16) }}>{view.born.bornOn}</div> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: px(36),
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            paddingTop: px(8),
            paddingBottom: px(8),
            paddingLeft: px(24),
            paddingRight: px(24),
            borderRadius: px(999),
            background: color('--color-soft'),
            fontSize: px(28),
            fontWeight: 700,
          }}
        >
          {addressParts(address).map(([part, accent]) => (
            <span key={part} style={{ color: color(accent ? '--color-accent-ink' : '--color-text') }}>
              {part}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * An Address split as the Platform's name is drawn: the Site's own subdomain
 * and the top-level domain in the accent, the scheme and the name between
 * them in the text color (`https://` `christian` `.loading` `.baby`). The
 * scheme stays so the pill reads as a web address, which `.baby` alone may not.
 */
function addressParts(address: string): [string, boolean][] {
  const [, scheme = '', host = address] = /^([a-z]+:\/\/)?(.*)$/.exec(address) ?? [];
  const labels = host.split('.');
  if (labels.length < 3) {
    return [[address, false]];
  }
  const last = labels.length - 1;
  return [
    [scheme, false],
    [labels[0], true],
    [`.${labels.slice(1, last).join('.')}`, false],
    [`.${labels[last]}`, true],
  ];
}
