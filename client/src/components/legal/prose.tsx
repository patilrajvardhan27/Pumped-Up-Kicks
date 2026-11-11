import type { ReactNode } from 'react';
import { TEXT_LINK } from '@/components/ui/TextLink';
import { site } from '@/lib/site';

/* Building blocks for the legal pages, so the text files stay about the words. */

export function LegalHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="flex flex-col gap-3 border-b border-pebble pb-8">
      <p className="text-caption text-slate-gray">Updated {site.legalUpdated}</p>
      <h1 className="text-subheading text-ink-navy md:text-heading-sm">{title}</h1>
      <p className="measure text-body text-slate-gray">{intro}</p>
    </header>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-title text-ink-navy">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="measure text-body text-slate-gray">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex measure list-disc flex-col gap-2 pl-5 text-body text-slate-gray marker:text-slate-gray">{children}</ul>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-body-strong text-ink-navy">{children}</strong>;
}

/** Who is responsible. Falls back to plain wording until the operator is configured. */
export function Operator() {
  return <>{site.operator ?? `The operator of ${site.name}`}</>;
}

export function ContactLine() {
  return (
    <P>
      {site.contactEmail ? (
        <>
          Write to{' '}
          <a href={`mailto:${site.contactEmail}`} className={TEXT_LINK}>
            {site.contactEmail}
          </a>
          .
        </>
      ) : (
        <>Use the contact details published wherever you found this service.</>
      )}
    </P>
  );
}

export function LegalBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-8 pt-8">{children}</div>;
}
