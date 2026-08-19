import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'signal' | 'live' | 'fault' | 'cross';
  size?: 'sm' | 'md';
}

export default function Badge({ children, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const variants = {
    neutral: 'border-line text-faint',
    signal: 'border-signal/40 text-signal bg-signal/10',
    live: 'border-live/40 text-live bg-live/10',
    fault: 'border-fault/40 text-fault bg-fault/10',
    cross: 'border-cross/40 text-cross bg-cross/10',
  };

  const sizes = {
    sm: 'text-[0.65rem] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}
