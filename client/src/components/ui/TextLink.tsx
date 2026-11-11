import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** An inline link inside running text: Signal Blue, always underlined so it never relies on colour alone. */
export const TEXT_LINK = 'rounded-md text-signal-blue underline underline-offset-2 hover:text-signal-blue-hover';

export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cn(TEXT_LINK, className)} {...rest} />;
}
