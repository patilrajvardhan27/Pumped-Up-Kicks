import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** The look every form field shares (inputs and native selects): Pebble fill, hairline edge, blue on focus. */
export const FIELD =
  'rounded-lg border border-hairline bg-pebble text-ink-navy focus-visible:border-signal-blue focus-visible:bg-paper disabled:text-mist-gray';

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
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'text-label text-ink-navy'}>
        {label}
      </label>
      <span className="relative flex items-center">
        {leading && <span className="pointer-events-none absolute left-3 flex text-slate-gray">{leading}</span>}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={noteId}
          className={cn(
            FIELD,
            'h-11 w-full px-3 text-body placeholder:text-slate-gray',
            Boolean(leading) && 'pl-9',
            error && 'border-danger',
          )}
          {...rest}
        />
      </span>
      {error ? (
        <p id={noteId} className="text-caption text-danger">
          {error}
        </p>
      ) : helperText ? (
        <p id={noteId} className="text-caption text-slate-gray">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
