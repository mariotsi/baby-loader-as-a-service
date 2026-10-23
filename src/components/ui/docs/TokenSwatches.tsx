import type { CSSProperties, ReactNode } from 'react';
import { FONTS, PALETTES, PLATFORM_FONT, PLATFORM_PALETTE, platformStyle } from '@/lib/theme';
import { ContrastReport } from '../demos/ContrastReport';
import styles from './docs.module.css';

const ALL_PALETTES = [PLATFORM_PALETTE, ...PALETTES];

/** Docs pages are not wrapped by the story decorator, so their blocks bring the Platform theme themselves. */
function Themed({ children }: { children: ReactNode }) {
  return (
    <div className={styles.themed} style={platformStyle() as CSSProperties}>
      {children}
    </div>
  );
}

/** Every color token of every Palette, as a table of swatches. */
export function PaletteTable() {
  const tokens = Object.keys(PLATFORM_PALETTE.vars).filter((t) => t !== '--color-scheme') as `--color-${string}`[];
  return (
    <Themed>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              {ALL_PALETTES.map((p) => (
                <th scope="col" key={p.id}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token}>
                <th scope="row">
                  <code>{token}</code>
                </th>
                {ALL_PALETTES.map((p) => {
                  const color = p.vars[token as keyof typeof p.vars];
                  return (
                    <td key={p.id}>
                      <span className={styles.chip} style={{ background: color }} />
                      <code>{color}</code>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Themed>
  );
}

/** Each Font's display and body faces, written in themselves. */
export function FontTable() {
  return (
    <Themed>
      <div className={styles.fonts}>
        {[PLATFORM_FONT, ...FONTS].map((font) => (
          <div key={font.id} className={styles.font}>
            <p className={styles.fontName}>{font.name}</p>
            <p
              style={{ fontFamily: font.display.cssStack, fontWeight: font.display.weight }}
              className={styles.display}
            >
              Welcome, Emma
            </p>
            <p style={{ fontFamily: font.body.cssStack, fontWeight: font.body.weight }}>
              Born on 13 September at 15:08, and already the boss of the house.
            </p>
          </div>
        ))}
      </div>
    </Themed>
  );
}

/** The contrast report of every Palette. */
export function ContrastReports() {
  return (
    <Themed>
      <div className={styles.reports}>
        {ALL_PALETTES.map((p) => (
          <div key={p.id} className={styles.scroll}>
            <ContrastReport palette={p} />
          </div>
        ))}
      </div>
    </Themed>
  );
}
