import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({ label, error, helperText, className = '', ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="eyebrow mb-2 block">{label}</label>}
      <input
        className={`input-field ${error ? 'border-fault focus:border-fault focus:ring-fault' : ''} ${className}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {error && <p className="mt-2 text-sm text-fault">{error}</p>}
      {helperText && !error && <p className="mt-2 text-sm text-faint">{helperText}</p>}
    </div>
  );
}
