import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** A small outlined pill for status and mode labels. */
export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border border-hairline bg-surface-card px-3',
        'whitespace-nowrap text-caption-sm text-ink',
        className,
      )}
      {...rest}
    />
  );
}
