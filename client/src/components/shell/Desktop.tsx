import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DesktopProps {
  children: ReactNode;
  /** Pin the desktop to the viewport on large screens; windows scroll inside it. */
  fixed?: boolean;
}

/** The wallpapered surface every page sits on. */
export function Desktop({ children, fixed = false }: DesktopProps) {
  return (
    <div className={cn('wallpaper flex min-h-dvh flex-col', fixed && 'lg:h-dvh lg:overflow-hidden')}>
      {children}
    </div>
  );
}
