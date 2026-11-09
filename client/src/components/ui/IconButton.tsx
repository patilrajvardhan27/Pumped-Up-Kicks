import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone says nothing to a screen reader. */
  'aria-label': string;
  tone?: 'neutral' | 'danger' | 'on-dark';
}

const TONE = {
  neutral: 'text-mute-strong hover:bg-surface-soft hover:text-ink',
  danger: 'text-mute-strong hover:bg-danger-soft hover:text-danger',
  'on-dark': 'text-on-dark hover:text-accent-on-dark',
};

export function IconButton({ tone = 'neutral', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-11 shrink-0 sm:size-9 items-center justify-center rounded-md',
        'transition-transform active:translate-y-px disabled:text-disabled disabled:active:translate-y-0',
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
