import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { ButtonLink } from '@/components/ui/Button';
import { Desktop } from './Desktop';
import { MenuBar } from './MenuBar';

interface DocumentWindowProps {
  /** Shown in the window's title bar. */
  title: string;
  children: ReactNode;
}

/** The desktop, menu bar and a static window: the frame for pages that are read, not played with. */
export function DocumentWindow({ title, children }: DocumentWindowProps) {
  return (
    <Desktop>
      <MenuBar
        actions={
          <ButtonLink href="/app" size="sm" data-track="menubar-open-workspace">
            Open the workspace
          </ButtonLink>
        }
      />
      <div className="flex flex-1 px-2 pb-8 lg:px-3">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col self-start overflow-hidden rounded-xl border border-hairline bg-canvas shadow-window">
          {/* Decorative: the page already has its own title and heading. */}
          <div aria-hidden="true" className="flex h-10 shrink-0 items-center border-b border-hairline-soft bg-surface-soft px-4">
            <span className="truncate text-caption-sm text-mute-strong">{title}</span>
          </div>
          <main id="main" tabIndex={-1} className="px-4 py-8 sm:px-10 sm:py-10">
            {children}
          </main>
          <SiteFooter />
        </div>
      </div>
    </Desktop>
  );
}
