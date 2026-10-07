import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone says nothing to a screen reader. */
  'aria-label': string;
  tone?: 'neutral' | 'danger' | 'on-dark';
}

const TONE = {
  neutral: 'text-mute-strong hover:bg-surface-soft hover:text-ink',
  danger: 'text-mute-strong hover:bg-accent-red-soft hover:text-danger',
  'on-dark': 'text-on-dark hover:text-primary',
};

export function IconButton({ tone = 'neutral', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md',
        'transition-transform active:scale-90 disabled:text-ash disabled:active:scale-100',
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
