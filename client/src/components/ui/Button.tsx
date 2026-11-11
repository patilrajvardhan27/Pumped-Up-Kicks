import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/*
 * primary: Signal Blue, the one main action on a screen.
 * dark: Ink Navy, a secondary filled action. Keep it apart from primary.
 * secondary: white with a hairline border, for quieter actions.
 * tertiary: text only, for inline and toolbar actions.
 */
type Variant = 'primary' | 'dark' | 'secondary' | 'tertiary';
type Size = 'sm' | 'md';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-signal-blue text-paper hover:bg-signal-blue-hover hover:shadow-button',
  dark: 'bg-ink-navy text-paper focus-on-dark hover:shadow-button',
  secondary: 'border border-hairline bg-paper text-ink-navy hover:bg-pebble',
  tertiary: 'text-ink-navy hover:bg-pebble',
};

const SIZE: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-button-sm',
  md: 'min-h-12 px-4 text-button',
};

/** Shared by <Button> and <ButtonLink>, so a link and a button look the same. */
export function buttonClasses({ variant = 'primary', size = 'md', block }: StyleProps, className?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg whitespace-nowrap no-underline',
    'transition-[background-color,box-shadow,transform] active:translate-y-px',
    'disabled:bg-pebble disabled:text-mist-gray disabled:shadow-none disabled:active:translate-y-0',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
    className,
  );
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, size, block, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, block }, className)} {...rest} />;
}

type ButtonLinkProps = StyleProps & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, block, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, block }, className)} {...rest} />;
}
