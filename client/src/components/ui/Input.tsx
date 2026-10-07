import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Shown above the field. Pass labelHidden to keep it for screen readers only. */
  label: string;
  id: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
}

export function Input({ label, id, labelHidden, helperText, error, className, ...rest }: InputProps) {
  const noteId = error || helperText ? `${id}-note` : undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'text-caption-md text-ink'}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={noteId}
        className={cn(
          'h-10 w-full rounded-md border bg-surface-card px-3 text-body-md text-ink',
          'placeholder:text-mute-strong focus-visible:border-accent-blue',
          'disabled:bg-surface-soft disabled:text-mute-strong',
          error ? 'border-danger' : 'border-hairline-strong',
        )}
        {...rest}
      />
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
