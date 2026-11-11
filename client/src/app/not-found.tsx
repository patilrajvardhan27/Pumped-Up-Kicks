import type { Metadata } from 'next';
import { ArticleShell } from '@/components/site/PageShell';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowLeftIcon, LostIcon } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <ArticleShell>
      <div className="flex flex-col items-start gap-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-blue-wash text-signal-blue">
          <LostIcon className="size-6" />
        </span>
        <div className="flex flex-col gap-3">
          <p className="text-caption-strong tracking-wide text-slate-gray uppercase">404</p>
          <h1 className="text-heading-sm text-ink-navy md:text-heading">Nothing at this timestamp.</h1>
          <p className="measure-narrow text-body-lg text-slate-gray">
            The link may be old, or the address mistyped. Head back to the start and try again.
          </p>
        </div>
        <ButtonLink href="/" data-track="404-home">
          <ArrowLeftIcon />
          Back to the home page
        </ButtonLink>
      </div>
    </ArticleShell>
  );
}
