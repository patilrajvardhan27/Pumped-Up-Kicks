import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export default function Badge({ children, variant = 'primary', size = 'md' }: BadgeProps) {
  const variants = {
    primary: 'bg-electric-blueberry text-snowflake-surprise',
    secondary: 'bg-sunny-delight text-void-vibes',
    success: 'bg-minty-fresh text-snowflake-surprise',
    warning: 'bg-banana-bonanza text-void-vibes',
    error: 'bg-strawberry-shock text-snowflake-surprise',
    info: 'bg-sky-diver text-snowflake-surprise',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
