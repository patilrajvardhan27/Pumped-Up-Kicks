import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'tertiary';
type Size = 'sm' | 'md';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

/*
 * A button is a face sitting on a darker edge. Hover lifts the face, press
 * drops it flush. Only transform moves, so it costs nothing to animate.
 */
const EDGE: Record<Variant, string> = {
  primary: 'bg-primary-active',
  secondary: 'bg-hairline-strong',
  tertiary: 'bg-transparent',
};

const FACE: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary group-active/btn:bg-primary-pressed',
  secondary: 'border border-hairline-strong bg-surface-soft text-ink',
  tertiary: 'text-ink group-hover/btn:bg-surface-soft',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-button-sm',
  md: 'h-10 px-4 text-button-md',
};

function edgeClasses({ variant = 'primary', block }: StyleProps, className?: string) {
  return cn(
    'group/btn mt-0.5 inline-flex shrink-0 rounded-md align-middle no-underline',
    'disabled:bg-transparent',
    EDGE[variant],
    block && 'flex w-full',
    className,
  );
}

function Face({ variant = 'primary', size = 'md', children }: StyleProps & { children: ReactNode }) {
  return (
    <span
      className={cn(
        'flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-md',
        '-translate-y-0.5 transition-transform',
        'group-hover/btn:-translate-y-[3px] group-active/btn:translate-y-0',
        'group-disabled/btn:translate-y-0 group-disabled/btn:border-transparent',
        'group-disabled/btn:bg-surface-soft group-disabled/btn:text-ash',
        FACE[variant],
        SIZE[size],
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant, size, block, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={edgeClasses({ variant, block }, className)} {...rest}>
      <Face variant={variant} size={size}>
        {children}
      </Face>
    </button>
  );
}

type ButtonLinkProps = StyleProps & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={edgeClasses({ variant, block }, className)} {...rest}>
      <Face variant={variant} size={size}>
        {children as ReactNode}
      </Face>
    </Link>
  );
}
