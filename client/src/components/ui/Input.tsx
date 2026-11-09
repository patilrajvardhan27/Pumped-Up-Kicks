import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shown above the field. Pass labelHidden to keep it for screen readers only. */
  label: string;
  id: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
  /** An icon drawn inside the left edge of the field. */
  leading?: ReactNode;
}

export function Input({ label, id, labelHidden, helperText, error, leading, className, ...rest }: InputProps) {
  const noteId = error || helperText ? `${id}-note` : undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'text-body-sm-strong text-ink'}>
        {label}
      </label>
      <span className="relative flex items-center">
        {leading && <span className="pointer-events-none absolute left-3 flex text-mute-strong">{leading}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          className={cn(
            'h-11 w-full rounded-sm border bg-surface-card px-3 text-body-md text-ink sm:h-10',
            Boolean(leading) && 'pl-9',
            'placeholder:text-mute-strong focus-visible:border-focus',
            'disabled:bg-surface-soft disabled:text-mute-strong',
            error ? 'border-danger' : 'border-hairline-strong',
          )}
          {...rest}
        />
      </span>
      {error ? (
        <p id={noteId} className="text-caption-sm text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={noteId} className="text-caption-sm text-mute-strong">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
