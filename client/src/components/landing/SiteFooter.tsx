import Link from 'next/link';
import { ConsentSettingsButton } from '@/components/consent/ConsentBanner';
import { Wordmark } from '@/components/ui/Wordmark';
import { LEGAL_PAGES } from '@/lib/legal';

const LINK =
  'inline-flex min-h-10 items-center rounded-sm text-body-sm text-body hover:text-ink hover:underline';

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="flex flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Wordmark />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6">
          <Link href="/#how" className={LINK}>
            How it works
          </Link>
          <Link href="/#preview" className={LINK}>
            Preview
          </Link>
          <Link href="/app" className={LINK}>
            Workspace
          </Link>
          {LEGAL_PAGES.map((page) => (
            <Link key={page.path} href={page.path} className={LINK}>
              {page.label}
            </Link>
          ))}
          <ConsentSettingsButton className={LINK} />
        </nav>
      </div>
    </footer>
  );
}
