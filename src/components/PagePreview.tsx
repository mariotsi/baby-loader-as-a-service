import type { CSSProperties } from 'react';
import { Countdown } from '@/components/Countdown';
import type { PublicPageView } from '@/lib/publicPageView';
import { themeStyle } from '@/lib/theme';
import styles from './PagePreview.module.css';

/**
 * A small picture of a Public page in its own Theme, for the Platform's
 * pages: the onboarding form redraws it with every pick. It shows the same
 * view the Public page renders, so the two never disagree.
 */
export function PagePreview({ view, theme }: { view: PublicPageView; theme: { palette: string; font: string } }) {
  return (
    <div className={styles.preview} style={themeStyle(theme) as CSSProperties}>
      <p className={styles.tagline}>{view.tagline}</p>
      <p className={styles.title}>{view.title}</p>
      {view.sex ? <p className={styles.sex}>{view.sex}</p> : null}
      {view.waiting ? (
        <div className={styles.countdown}>
          <Countdown waiting={view.waiting} size="sm" />
        </div>
      ) : null}
    </div>
  );
}
