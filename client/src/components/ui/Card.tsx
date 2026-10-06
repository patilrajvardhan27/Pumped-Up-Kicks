import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  /** 24px is the standard; 20px suits compact tiles; none lets the caller decide. */
  padding?: 'none' | 'tile' | 'standard';
}

const PADDING = { none: '', tile: 'p-5', standard: 'p-6' };

export function Card({ as: Tag = 'div', padding = 'standard', className, ...rest }: CardProps) {
  return <Tag className={cn('card', PADDING[padding], className)} {...rest} />;
}
