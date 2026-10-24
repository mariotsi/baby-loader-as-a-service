import { LogoMark } from './Logo';
import styles from './Spinner.module.css';

interface SpinnerProps {
  /**
   * What is loading, for screen readers: "Loading your sites". Leave it out
   * when something next to the Spinner already says so, like a Button's
   * "Saving…".
   */
  label?: string;
  /** `md` sits in a line of text or a Button; `lg` stands for a whole region that is loading. */
  size?: 'md' | 'lg';
  /** `current` takes the surrounding text color; `brand` the Palette's colors, for a Spinner on its own. */
  tone?: 'current' | 'brand';
  className?: string;
}

/**
 * The one spinner of the Platform and the Public pages: the logo's sleepy
 * baby, its ring turning while work is in flight. A Button shows it on its
 * own when `loading`. Under reduced motion the ring stands still.
 */
export function Spinner({ label, size = 'md', tone = 'current', className }: SpinnerProps) {
  const classes = [styles.spinner, size === 'lg' && styles.lg, className].filter(Boolean).join(' ');
  const mark = <LogoMark tone={tone} spinning className={styles.mark} />;
  return label ? (
    <span className={classes} role="img" aria-label={label}>
      {mark}
    </span>
  ) : (
    <span className={classes} aria-hidden="true">
      {mark}
    </span>
  );
}
