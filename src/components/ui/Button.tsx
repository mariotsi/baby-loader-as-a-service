import Link from 'next/link';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import styles from './Button.module.css';
import { Icon, type IconName } from './Icon';
import { Spinner } from './Spinner';
import { VisuallyHidden } from './VisuallyHidden';

interface ButtonLook {
  /** `primary` is the one main action of a view; `secondary` is the default; `ghost` is for quiet, repeated actions. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'link';
  /** `phoneSm` is `sm` with no icon below 30rem and `md` above, for two actions that must share a phone's line. */
  size?: 'md' | 'sm' | 'phoneSm';
  icon?: IconName;
  /** `end` puts the icon after the label, for actions that move forward or leave the page. */
  iconPosition?: 'start' | 'end';
  fullWidth?: boolean;
  /** Fits the content with no padding or minimum height, for actions embedded in text. */
  inline?: boolean;
  /**
   * Shows only the icon and gives the label to screen readers, for an
   * action repeated in a dense row. Needs `icon`.
   */
  labelHidden?: boolean;
}

function lookClassName(
  { variant = 'secondary', size = 'md', fullWidth, labelHidden, inline }: ButtonLook,
  className?: string
): string {
  return [
    styles.button,
    styles[variant],
    size === 'sm' && styles.sm,
    size === 'phoneSm' && styles.phoneSm,
    fullWidth && styles.fullWidth,
    inline && styles.inline,
    labelHidden && styles.iconOnly,
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

/** The label with at most one icon; while loading, the Spinner takes the icon's place, or the start without one. */
function Content({
  icon,
  iconPosition = 'start',
  loading,
  labelHidden,
  children,
}: ButtonLook & { loading?: boolean; children: ReactNode }) {
  const position = icon ? iconPosition : 'start';
  let glyph: ReactNode = null;
  if (loading) {
    glyph = <Spinner />;
  } else if (icon) {
    glyph = <Icon name={icon} className={position === 'end' ? styles.iconEnd : styles.icon} />;
  }
  return (
    <>
      {position === 'start' ? glyph : null}
      {labelHidden ? <VisuallyHidden>{children}</VisuallyHidden> : <span>{children}</span>}
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
    /**
     * Ignores presses while another action's work is in flight. The button
     * stays focusable and announced as disabled, so a dialog keeps the focus
     * that sits on it.
     */
    disabled?: boolean;
  };

/** A button for an action on this page. To go to another page, use `ButtonLink`. */
export function Button({
  variant,
  size,
  icon,
  iconPosition,
  fullWidth,
  inline,
  labelHidden,
  loading = false,
  disabled = false,
  className,
  type = 'button',
  onClick,
  children,
  ...rest
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading || disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      {...rest}
      type={type}
      className={lookClassName({ variant, size, fullWidth, labelHidden, inline }, className)}
      aria-disabled={loading || disabled || undefined}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      <Content icon={icon} iconPosition={iconPosition} loading={loading} labelHidden={labelHidden}>
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
  inline,
  labelHidden,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} className={lookClassName({ variant, size, fullWidth, labelHidden, inline }, className)}>
      <Content icon={icon} iconPosition={iconPosition} labelHidden={labelHidden}>
        {children}
      </Content>
    </Link>
  );
}
