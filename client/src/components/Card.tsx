import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  accentColor?: string;
  className?: string;
}

export default function Card({ children, accentColor, className = '' }: CardProps) {
  const borderColorClass = accentColor
    ? `border-l-4 border-l-${accentColor}`
    : '';

  return (
    <div className={`bg-snowflake-surprise border border-silver-lining rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow duration-200 ${borderColorClass} ${className}`}>
      {children}
    </div>
  );
}
