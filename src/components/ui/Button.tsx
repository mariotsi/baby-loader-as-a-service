import Link from 'next/link';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import styles from './Button.module.css';
import { Icon, type IconName } from './Icon';

interface ButtonLook {
  /** `primary` is the one main action of a view; `secondary` is the default; `ghost` is for quiet, repeated actions. */
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
  icon?: IconName;
  /** `end` puts the icon after the label, for actions that move forward or leave the page. */
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
}

function lookClassName({ variant = 'secondary', size = 'md', fullWidth }: ButtonLook, className?: string): string {
  return [styles.button, styles[variant], size === 'sm' && styles.sm, fullWidth && styles.fullWidth, className]
    .filter(Boolean)
    .join(' ');
}

/** The label with at most one icon; while loading, a spinner takes the icon's place, or the start without one. */
function Content({
  icon,
  iconPosition = 'start',
  loading,
  children,
}: ButtonLook & { loading?: boolean; children: ReactNode }) {
  const name = loading ? 'loader' : icon;
  const position = icon ? iconPosition : 'start';
  let glyphClass = position === 'end' ? styles.iconEnd : styles.icon;
  if (loading) {
    glyphClass = styles.spinner;
  }
  const glyph = name ? <Icon name={name} className={glyphClass} /> : null;
  return (
    <>
      {position === 'start' ? glyph : null}
      <span>{children}</span>
      {position === 'end' ? glyph : null}
    </>
  );
}

type ButtonProps = ButtonLook &
  Omit<ComponentProps<'button'>, 'disabled'> & {
    /**
     * Shows a spinner and ignores presses while work is in flight. The button
     * stays focusable and announced as busy; pass the in-progress label
     * ("Saving…") as children.
     */
    loading?: boolean;
  };

/** A button for an action on this page. To go to another page, use `ButtonLink`. */
export function Button({
  variant,
  size,
  icon,
  iconPosition,
  fullWidth,
  loading = false,
  className,
  type = 'button',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={lookClassName({ variant, size, fullWidth }, className)}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      <Content icon={icon} iconPosition={iconPosition} loading={loading}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = ButtonLook & ComponentProps<typeof Link>;

/** A link that looks like a button: for navigation, to a page of the Platform or a Site's Address. */
export function ButtonLink({
  variant,
  size,
  icon,
  iconPosition,
  fullWidth,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} className={lookClassName({ variant, size, fullWidth }, className)}>
      <Content icon={icon} iconPosition={iconPosition}>
        {children}
      </Content>
    </Link>
  );
}
