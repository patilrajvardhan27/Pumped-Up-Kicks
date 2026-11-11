import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { PRODUCT_LINKS } from '@/lib/navigation';

interface SiteHeaderProps {
  /** Right-hand controls. Defaults to the marketing call to action. */
  actions?: ReactNode;
  /** Centered menu; hidden in the workspace, where it would only distract. */
  showNav?: boolean;
  /** Sits beside the wordmark, e.g. the page name in the workspace. */
  children?: ReactNode;
}

/** The 64px sticky bar: wordmark left, menu centered, actions right. */
export function SiteHeader({ actions, showNav = true, children }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-(--z-nav) border-b border-hairline bg-paper/95 backdrop-blur">
      <div className="page flex h-(--spacing-nav) items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Wordmark />
          {children}
        </div>

        {showNav && (
          <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
            {PRODUCT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md text-label text-ink-navy hover:text-signal-blue"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {actions ?? (
            <ButtonLink href="/app" variant="dark" size="sm" data-track="header-get-started">
              Get started
            </ButtonLink>
          )}
        </div>
      </div>
    </header>
  );
}
