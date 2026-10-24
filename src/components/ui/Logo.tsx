import styles from './Logo.module.css';

interface LogoMarkProps {
  /** `brand` draws the mark in the Palette's colors; `current` draws it in the surrounding text color, as on a Button. */
  tone?: 'brand' | 'current';
  /** Turns the ring for as long as it is shown: only the `Spinner` sets it. */
  spinning?: boolean;
  className?: string;
}

/**
 * The Sleepy spinner: a baby asleep inside a loading ring, the curl on its
 * head where the ring starts. Sized to the text around it and decorative,
 * so whatever holds it carries the meaning. The ring sits in its own group
 * because a transform the motion sets would replace the one that places it.
 */
export function LogoMark({ tone = 'brand', spinning = false, className }: LogoMarkProps) {
  return (
    <svg
      className={[styles.mark, styles[tone], spinning && styles.spinning, className].filter(Boolean).join(' ')}
      width="1.25em"
      height="1.25em"
      viewBox="4.5 5 91 91"
      fill="none"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.track} cx="50" cy="56" r="34" strokeWidth="10" />
      <g className={styles.ring}>
        <circle
          className={styles.arc}
          cx="50"
          cy="56"
          r="34"
          strokeWidth="10"
          pathLength="100"
          strokeDasharray="68 100"
          transform="rotate(-80 50 56)"
        />
      </g>
      <path className={styles.line} d="M50 22 C 43 13 57 8 55 17" strokeWidth="6" />
      <ellipse className={styles.cheek} cx="33" cy="65" rx="5.5" ry="3.5" />
      <ellipse className={styles.cheek} cx="67" cy="65" rx="5.5" ry="3.5" />
      <path className={styles.line} d="M34 55 Q40 61 46 55 M54 55 Q60 61 66 55" strokeWidth="6" />
      <circle className={styles.mouth} cx="50" cy="69" r="2.8" strokeWidth="4" />
    </svg>
  );
}

/**
 * The Platform's name with its mark, as the header of every Platform page
 * shows it. On hover the ring turns once and the baby tilts its head. The
 * name is real text, so it is the accessible name of the link around it.
 */
export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark className={styles.logoMark} />
      <span>
        Loading <span className={styles.baby}>Baby</span>
      </span>
    </span>
  );
}
