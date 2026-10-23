import { type ReactNode, useId } from 'react';
import styles from './Card.module.css';

interface CardProps {
  /** Names the card as a region; without it the card is a plain box. */
  title?: ReactNode;
  description?: ReactNode;
  /** Keeps the outline of the page in order: 1 when the card is the page, 2 under the page's h1, 3 inside an h2 section. */
  headingLevel?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

/** A raised surface that groups related content, like one section of the Site settings. */
export function Card({ title, description, headingLevel = 2, children, className }: CardProps) {
  const headingId = useId();
  const Heading = (['h1', 'h2', 'h3'] as const)[headingLevel - 1];
  const classes = [styles.card, className].filter(Boolean).join(' ');
  if (!title) {
    return <div className={classes}>{children}</div>;
  }
  return (
    <section className={classes} aria-labelledby={headingId}>
      <header className={styles.header}>
        <Heading id={headingId} className={styles.title}>
          {title}
        </Heading>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
