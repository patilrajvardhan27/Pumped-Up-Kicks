import type { ReactNode } from 'react';
import { site } from '@/lib/site';

/* Building blocks for the legal pages, so the text files stay about the words. */

export function LegalHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <header className="flex flex-col gap-3 border-b border-hairline-soft pb-8">
      <p className="eyebrow">Updated {site.legalUpdated}</p>
      <h1 className="text-display-md text-ink md:text-display-xl">{title}</h1>
      <p className="max-w-[60ch] text-body-md text-body">{intro}</p>
    </header>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-20 flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-heading-lg text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="max-w-[68ch] text-body-sm text-body">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-body-sm text-body marker:text-mute-strong">{children}</ul>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

/** Who is responsible. Falls back to plain wording until the operator is configured. */
export function Operator() {
  return <>{site.operator ?? `the operator of ${site.name}`}</>;
}

export function ContactLine() {
  return (
    <P>
      {site.contactEmail ? (
        <>
          Write to{' '}
          <a href={`mailto:${site.contactEmail}`} className="text-link-blue underline">
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
