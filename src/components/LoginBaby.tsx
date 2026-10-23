import { type CSSProperties, useId } from 'react';
import styles from './LoginBaby.module.css';

export type LoginBabyState = 'sleeping' | 'awake' | 'watching' | 'covering';

interface LoginBabyProps {
  /**
   * `sleeping` until the Owner first focuses a field, then `awake`;
   * `watching` while they type their email, `covering` its eyes while they
   * type their password.
   */
  state: LoginBabyState;
  /** Where the eyes look while watching: -1 at the start of the email field, 1 at its end. */
  look?: number;
}

/**
 * The baby peeking over the login card. It is decoration, so assistive
 * technology skips it, and its colors are the theme's tokens, an outline
 * drawing rather than a skin tone. The zZz floats for a few seconds and then
 * rests, and under `prefers-reduced-motion` the states change without moving.
 */
export function LoginBaby({ state, look = 0 }: LoginBabyProps) {
  const aboveCard = useId();
  return (
    <svg
      className={styles.baby}
      data-state={state}
      style={{ '--look': Math.max(-1, Math.min(1, look)) } as CSSProperties}
      viewBox="0 0 220 170"
      aria-hidden="true"
      focusable="false"
    >
      <g className={styles.head}>
        <circle className={styles.skin} cx="52" cy="96" r="13" />
        <circle className={styles.skin} cx="168" cy="96" r="13" />
        <circle className={styles.skin} cx="110" cy="92" r="58" />
        <path className={styles.line} d="M110 35 C 98 20, 122 12, 117 28" />
        <ellipse className={styles.cheek} cx="76" cy="110" rx="11" ry="7" />
        <ellipse className={styles.cheek} cx="144" cy="110" rx="11" ry="7" />
        <g className={styles.open}>
          <g className={styles.pupils}>
            <circle className={styles.pupil} cx="88" cy="88" r="6.5" />
            <circle className={styles.pupil} cx="132" cy="88" r="6.5" />
          </g>
          <path className={styles.line} d="M100 116 Q110 124 120 116" />
        </g>
        <g className={styles.closed}>
          <path className={styles.line} d="M79 90 Q88 97 97 90" />
          <path className={styles.line} d="M123 90 Q132 97 141 90" />
          <circle className={styles.line} cx="110" cy="119" r="4" />
        </g>
      </g>
      <g className={styles.zzz}>
        <text className={styles.z} x="160" y="40">
          z
        </text>
        <text className={styles.z} x="174" y="26">
          z
        </text>
        <text className={styles.z} x="190" y="12">
          Z
        </text>
      </g>
      {/* The arms rise from the card's edge, where the clip stops them, so the raised hands read as hands. */}
      <clipPath id={aboveCard}>
        <rect x="-20" y="-20" width="260" height="190" />
      </clipPath>
      <g clipPath={`url(#${aboveCard})`}>
        <g className={`${styles.hand} ${styles.left}`}>
          <rect className={styles.skin} x="60" y="150" width="26" height="110" rx="13" />
          <ellipse className={styles.skin} cx="92" cy="148" rx="8" ry="10" transform="rotate(25 92 148)" />
          <path
            className={styles.skin}
            d="M52 158 C 50 140, 62 132, 74 132 C 88 132, 96 142, 94 158 C 92 172, 54 174, 52 158 Z"
          />
          <path className={styles.line} d="M64 134 v9 M73 132 v10 M82 134 v9" />
        </g>
        <g className={`${styles.hand} ${styles.right}`}>
          <rect className={styles.skin} x="134" y="150" width="26" height="110" rx="13" />
          <ellipse className={styles.skin} cx="128" cy="148" rx="8" ry="10" transform="rotate(-25 128 148)" />
          <path
            className={styles.skin}
            d="M168 158 C 170 140, 158 132, 146 132 C 132 132, 124 142, 126 158 C 128 172, 166 174, 168 158 Z"
          />
          <path className={styles.line} d="M156 134 v9 M147 132 v10 M138 134 v9" />
        </g>
      </g>
    </svg>
  );
}
