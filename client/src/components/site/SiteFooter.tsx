import Link from 'next/link';
import { ConsentSettingsButton } from '@/components/consent/ConsentBanner';
import { Wordmark } from '@/components/ui/Wordmark';
import { FOOTER_COLUMNS } from '@/lib/navigation';
import { site } from '@/lib/site';

const LINK = 'inline-flex min-h-9 items-center rounded-md text-label text-ink-navy hover:text-signal-blue';

/** Link columns on the canvas: uppercase slate headings, navy links. */
export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-cloud">
      <div className="page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col items-start gap-3">
          <Wordmark />
          <p className="measure-narrow text-body-sm text-slate-gray">{site.description}</p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-1">
            <h2 className="mb-2 text-caption-strong tracking-wide text-slate-gray uppercase">{column.title}</h2>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href} className={LINK}>
                {link.label}
              </Link>
            ))}
            {column.title === 'Policies' && <ConsentSettingsButton className={LINK} />}
          </nav>
        ))}
      </div>
    </footer>
  );
}
