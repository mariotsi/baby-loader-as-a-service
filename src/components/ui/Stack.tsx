import type { CSSProperties, ReactNode } from 'react';
import styles from './Stack.module.css';

type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface StackProps {
  /** Space between children, as a step of the spacing scale. */
  gap?: Space;
  /** `row` wraps onto new lines when it runs out of room, so it holds on a phone. */
  direction?: 'column' | 'row';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  children: ReactNode;
  className?: string;
}

/** Lays children out in a column or a wrapping row, spaced by the spacing scale. */
export function Stack({ gap = 4, direction = 'column', align, justify, children, className }: StackProps) {
  const style = {
    '--stack-gap': `var(--space-${gap})`,
    '--stack-align': align === 'start' || align === 'end' ? `flex-${align}` : align,
    '--stack-justify': justify === 'between' ? 'space-between' : justify && `flex-${justify}`,
  } as CSSProperties;
  return (
    <div className={[styles.stack, styles[direction], className].filter(Boolean).join(' ')} style={style}>
      {children}
    </div>
  );
}
