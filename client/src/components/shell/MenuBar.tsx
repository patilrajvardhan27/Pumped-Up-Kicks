import type { ReactNode } from 'react';
import { Wordmark } from '@/components/ui/Wordmark';

interface MenuBarProps {
  /** Sits beside the wordmark: menus on the landing page, a title in the app. */
  children?: ReactNode;
  /** Right-aligned controls. */
  actions: ReactNode;
}

/** The floating bar across the top of the desktop. */
export function MenuBar({ children, actions }: MenuBarProps) {
  return (
    <header className="sticky top-0 z-(--z-nav) p-2">
      <div className="flex h-12 items-center justify-between gap-3 rounded-lg border border-hairline bg-canvas pr-1.5 pl-3">
        <div className="flex min-w-0 items-center gap-4">
          <Wordmark />
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
