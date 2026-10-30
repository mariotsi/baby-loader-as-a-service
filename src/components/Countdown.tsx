import type { CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { PublicPageView } from '@/lib/publicPageView';
import styles from './Countdown.module.css';

/**
 * The Countdown of a Waiting state: the days to go (or late), and the week of
 * pregnancy as a stroller riding a bar. The bar only illustrates the week
 * written under it, so assistive technology skips it.
 */
export function Countdown({
  waiting,
  size = 'md',
}: {
  waiting: NonNullable<PublicPageView['waiting']>;
  /** `sm` fits a preview card. */
  size?: 'md' | 'sm';
}) {
  const late = Boolean(waiting.lateNote);
  const overtime = Math.min(1, Math.max(0, (waiting.count ?? 0) / 14));
  const progress = Math.min(100, ((waiting.week?.number ?? 0) / 40) * 100);
  return (
    <div className={`${styles.countdown} ${size === 'sm' ? styles.sm : ''}`}>
      <p className={styles.count}>
        {waiting.count === null ? (
          <span className={styles.unit}>{waiting.unit}</span>
        ) : (
          <>
            <span className={styles.number}>{waiting.count}</span> <span className={styles.unit}>{waiting.unit}</span>
          </>
        )}
      </p>
      {waiting.lateNote ? <p className={styles.note}>{waiting.lateNote}</p> : null}
      {waiting.week ? (
        <div className={styles.progress}>
          <div
            className={`${styles.journey} ${late ? styles.extended : ''}`}
            aria-hidden="true"
            style={{ '--late-position': `${(1 - overtime) * 100}%` } as CSSProperties}
          >
            <div className={styles.track} style={{ '--progress': `${progress}%` } as CSSProperties} />
            {late ? (
              <>
                <svg className={styles.turn} viewBox="0 0 36 60" aria-hidden="true" focusable="false">
                  <path className={styles.railEdge} pathLength="100" d="M-1 6 H6 A24 24 0 0 1 6 54 H-1" />
                  <path className={styles.railFill} pathLength="100" d="M-1 6 H6 A24 24 0 0 1 6 54 H-1" />
                </svg>
                <div
                  className={`${styles.track} ${styles.returnTrack}`}
                  style={{ '--progress': `${overtime * 100}%` } as CSSProperties}
                />
              </>
            ) : null}
            <span
              className={styles.marker}
              style={{ left: `${late ? (1 - overtime) * 100 : progress}%`, top: late ? '3.375rem' : '0.375rem' }}
            >
              <Icon name="baby-carriage" />
            </span>
          </div>
          <p className={styles.week}>{waiting.week.label}</p>
        </div>
      ) : null}
      {waiting.lateScene ? (
        <div className={styles.scene}>
          {/* The illustration is decorative; the two captions carry the joke. */}
          {/* biome-ignore lint/performance/noImgElement: the transparent illustration uses its intrinsic aspect ratio in every preview. */}
          <img className={styles.illustration} src="/illustrations/late-checkout.png" alt="" />
          <p className={styles.babyQuote}>{waiting.lateScene.baby}</p>
          <p className={styles.mumQuote}>{waiting.lateScene.mum}</p>
        </div>
      ) : null}
    </div>
  );
}
