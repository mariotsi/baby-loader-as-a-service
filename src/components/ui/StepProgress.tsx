import styles from './StepProgress.module.css';

interface StepProgressProps {
  /** Names the list of steps for screen readers. */
  label: string;
  steps: string[];
  /** The index of the step being filled. */
  current: number;
}

/** Where a person stands in a form of a few short steps: a bar per step, named on a wide screen. */
export function StepProgress({ label, steps, current }: StepProgressProps) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={step}
          className={i < current ? `${styles.step} ${styles.done}` : styles.step}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className={styles.name}>{step}</span>
        </li>
      ))}
    </ol>
  );
}
