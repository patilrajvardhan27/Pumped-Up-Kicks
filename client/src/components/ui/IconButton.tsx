import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon alone says nothing to a screen reader. */
  'aria-label': string;
  tone?: 'neutral' | 'danger' | 'on-dark';
}

const TONE = {
  neutral: 'text-slate-gray hover:bg-pebble hover:text-ink-navy',
  danger: 'text-slate-gray hover:bg-danger-wash hover:text-danger',
  'on-dark': 'text-paper hover:text-mist-gray',
};

export function IconButton({ tone = 'neutral', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex size-11 shrink-0 sm:size-9 items-center justify-center rounded-lg',
        'transition-transform active:translate-y-px disabled:text-mist-gray disabled:active:translate-y-0',
        TONE[tone],
        className,
      )}
      {...rest}
    />
  );
}
