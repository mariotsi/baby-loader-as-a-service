import { contrastRatio, paletteContrastPairings, TEXT_MIN } from '@/lib/contrast';
import type { Palette } from '@/lib/theme';
import { Icon } from '../Icon';
import styles from './sheet.module.css';

/** Each pairing a Palette must pass, its measured ratio and whether it meets WCAG AA. */
export function ContrastReport({ palette }: { palette: Palette }) {
  const rows = paletteContrastPairings(palette.vars).map((p) => ({ ...p, ratio: contrastRatio(p.fg, p.bg) }));
  return (
    <table className={styles.report}>
      <caption className={styles.caption}>
        {palette.name}: {rows.filter((r) => r.ratio >= r.min).length} of {rows.length} pairings meet WCAG AA
      </caption>
      <thead>
        <tr>
          <th scope="col">Pairing</th>
          <th scope="col">Sample</th>
          <th scope="col">Ratio</th>
          <th scope="col">Needs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const ok = row.ratio >= row.min;
          return (
            <tr key={row.use}>
              <th scope="row">{row.use}</th>
              <td>
                {row.min >= TEXT_MIN ? (
                  <span className={styles.sample} style={{ color: row.fg, background: row.bg, borderColor: row.fg }}>
                    Aa
                  </span>
                ) : (
                  <span className={styles.sample} style={{ background: row.bg, borderColor: row.fg }} />
                )}
              </td>
              <td className={ok ? styles.pass : styles.fail}>
                <Icon name={ok ? 'circle-check' : 'alert'} /> {row.ratio.toFixed(2)}:1 {ok ? 'passes' : 'fails'}
              </td>
              <td>{row.min}:1</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
