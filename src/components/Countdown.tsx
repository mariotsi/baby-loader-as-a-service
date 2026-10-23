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
          <div className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ width: `${(waiting.week.number / 40) * 100}%` }} />
            <span className={styles.marker} style={{ left: `${(waiting.week.number / 40) * 100}%` }}>
              <Icon name="baby-carriage" />
            </span>
          </div>
          <p className={styles.week}>{waiting.week.label}</p>
        </div>
      ) : null}
    </div>
  );
}
