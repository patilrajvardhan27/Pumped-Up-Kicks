import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary: 'bg-electric-blueberry hover:bg-soft-serve active:bg-deep-purple-panda text-snowflake-surprise focus:ring-electric-blueberry',
    secondary: 'bg-sunny-delight hover:bg-butterscotch-dream active:bg-caramel-crush text-void-vibes focus:ring-sunny-delight',
    success: 'bg-minty-fresh hover:bg-limelight active:bg-forest-friend text-snowflake-surprise focus:ring-minty-fresh',
    warning: 'bg-banana-bonanza hover:bg-golden-glow active:bg-honey-buzz text-void-vibes focus:ring-banana-bonanza',
    error: 'bg-strawberry-shock hover:bg-blush-berry active:bg-crimson-crisis text-snowflake-surprise focus:ring-strawberry-shock',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
