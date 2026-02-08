import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({
  label,
  error,
  helperText,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-midnight-mystery mb-2">
          {label}
        </label>
      )}
      <input
        className={`
          input-field w-full
          ${error ? 'border-strawberry-shock focus:ring-strawberry-shock' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-strawberry-shock">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-slate-skate">{helperText}</p>
      )}
    </div>
  );
}
