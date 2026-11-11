import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** A pill label for status and mode: Deep Cobalt on a blue wash. Informational, never an action. */
export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-2 rounded-full bg-blue-wash px-3',
        'whitespace-nowrap text-caption-strong text-deep-cobalt',
        className,
      )}
      {...rest}
    />
  );
}
