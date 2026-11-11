import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li';
  /** 24px is the standard; 16px suits compact tiles; none lets the caller decide. */
  padding?: 'none' | 'tile' | 'standard';
}

const PADDING = { none: '', tile: 'p-4', standard: 'p-6' };

/** A white panel on the canvas: hairline border, 24px radius, soft blue-tinted shadow. */
export function Card({ as: Tag = 'div', padding = 'standard', className, ...rest }: CardProps) {
  return <Tag className={cn('panel', PADDING[padding], className)} {...rest} />;
}
