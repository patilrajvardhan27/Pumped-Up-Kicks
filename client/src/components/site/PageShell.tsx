import type { ReactNode } from 'react';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

interface PageShellProps {
  children: ReactNode;
  /** Passed to the header: workspace pages swap the marketing CTA for their own controls. */
  headerActions?: ReactNode;
  showNav?: boolean;
}

/** Header, main and footer: the frame every page outside the workspace shares. */
export function PageShell({ children, headerActions, showNav }: PageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader actions={headerActions} showNav={showNav} />
      <main id="main" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

/** A reading page (policies, 404): one 24px-radius white panel on the canvas. */
export function ArticleShell({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <div className="page section-y">
        <article className="panel mx-auto max-w-3xl px-6 py-10 sm:px-12 sm:py-12">{children}</article>
      </div>
    </PageShell>
  );
}
