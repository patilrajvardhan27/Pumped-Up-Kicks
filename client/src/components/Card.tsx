import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  /** Tailwind border colour class for the left rule, e.g. "border-l-signal". */
  accent?: string;
  className?: string;
}

export default function Card({ children, accent = 'border-l-line', className = '' }: CardProps) {
  return (
    <div
      className={`panel border-l-2 ${accent} p-6 transition-colors duration-200 hover:border-line-bright ${className}`}
    >
      {children}
    </div>
  );
}
