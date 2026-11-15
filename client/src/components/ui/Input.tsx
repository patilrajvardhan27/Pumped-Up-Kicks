import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** The look every form field shares (inputs and native selects): Pebble fill, hairline edge, blue on focus. */
export const FIELD =
  'rounded-lg border border-hairline bg-pebble text-ink-navy focus-visible:border-signal-blue focus-visible:bg-paper disabled:text-mist-gray';

interface FrameProps {
  /** Shown above the field. Pass labelHidden to keep it for screen readers only. */
  label: string;
  id: string;
  labelHidden?: boolean;
  helperText?: string;
  error?: string;
  className?: string;
}

/** The label, the field's own props and its note, shared by Input and TextArea. */
function frameParts({ id, helperText, error }: FrameProps) {
  const noteId = error || helperText ? `${id}-note` : undefined;
  return {
    noteId,
    fieldProps: { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': noteId },
    fieldClass: cn(FIELD, 'w-full px-3 text-body placeholder:text-slate-gray', error && 'border-danger'),
  };
}

function FieldFrame({ label, id, labelHidden, helperText, error, className, noteId, children }: FrameProps & { noteId?: string; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={id} className={labelHidden ? 'sr-only' : 'text-label text-ink-navy'}>
        {label}
      </label>
      {children}
      {(error || helperText) && (
        <p id={noteId} className={cn('text-caption', error ? 'text-danger' : 'text-slate-gray')}>
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

interface InputProps extends FrameProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  /** An icon drawn inside the left edge of the field. */
  leading?: ReactNode;
}

export function Input({ label, id, labelHidden, helperText, error, className, leading, ...rest }: InputProps) {
  const frame = { label, id, labelHidden, helperText, error, className };
  const { noteId, fieldProps, fieldClass } = frameParts(frame);
  return (
    <FieldFrame {...frame} noteId={noteId}>
      <span className="relative flex items-center">
        {leading && <span className="pointer-events-none absolute left-3 flex text-slate-gray">{leading}</span>}
        <input {...fieldProps} className={cn(fieldClass, 'h-11', Boolean(leading) && 'pl-9')} {...rest} />
      </span>
    </FieldFrame>
  );
}

type TextAreaProps = FrameProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>;

/** A multi-line field that grows with its text up to a few lines, then scrolls. */
export function TextArea({ label, id, labelHidden, helperText, error, className, ...rest }: TextAreaProps) {
  const frame = { label, id, labelHidden, helperText, error, className };
  const { noteId, fieldProps, fieldClass } = frameParts(frame);
  return (
    <FieldFrame {...frame} noteId={noteId}>
      <textarea {...fieldProps} className={cn(fieldClass, 'field-sizing-content max-h-40 min-h-11 resize-none py-2.5')} {...rest} />
    </FieldFrame>
  );
}
