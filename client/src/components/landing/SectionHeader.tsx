import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SectionHeaderProps {
  id: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: 'center' | 'left';
  children?: ReactNode;
}

/** The section intro: uppercase eyebrow, 38–50px navy heading, slate subtext. */
export function SectionHeader({ id, eyebrow, title, intro, align = 'center', children }: SectionHeaderProps) {
  const centered = align === 'center';
  return (
    <header className={cn('flex flex-col gap-4', centered ? 'mx-auto max-w-160 items-center text-center' : 'items-start')}>
      {eyebrow && <p className="text-caption-strong tracking-wide text-deep-cobalt uppercase">{eyebrow}</p>}
      <h2 id={id} className="text-heading-sm text-ink-navy lg:text-heading">
        {title}
      </h2>
      {intro && <p className="measure-narrow text-body-lg text-slate-gray">{intro}</p>}
      {children}
    </header>
  );
}
