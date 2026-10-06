import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-tight ' +
    'transition-all duration-150 disabled:cursor-not-allowed';

  const variants = {
    primary:
      'bg-signal text-well hover:bg-signal-bright active:bg-signal-low shadow-needle ' +
      'disabled:bg-transparent disabled:text-faint disabled:shadow-none disabled:border disabled:border-line',
    ghost:
      'border border-line text-muted hover:text-ink hover:border-line-bright bg-transparent disabled:text-faint',
    danger:
      'border border-fault-low text-fault hover:bg-fault-low/25 hover:border-fault bg-transparent disabled:opacity-50',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-[0.95rem]',
    lg: 'px-7 py-3.5 text-base',
  };

  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
