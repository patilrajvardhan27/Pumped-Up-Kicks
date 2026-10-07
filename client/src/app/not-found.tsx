import type { Metadata } from 'next';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { ButtonLink } from '@/components/ui/Button';
import { ArrowLeftIcon, LostIcon } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <DocumentWindow title="404: nothing at this timestamp">
      <div className="flex flex-col items-start gap-5">
        <span className="flex size-12 items-center justify-center rounded-md bg-surface-dark text-primary">
          <LostIcon className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-display-md text-ink md:text-display-xl">This page is not here.</h1>
          <p className="max-w-[52ch] text-body-md text-body">
            The link may be old, or the address mistyped. Scrub back to the start and try again.
          </p>
        </div>
        {/* A lecture strip with the needle parked where nothing was found. */}
        <div aria-hidden="true" className="strip-ribs relative h-14 w-full rounded-md bg-surface-dark">
          <span className="absolute inset-y-0 left-[28%] w-0.5 bg-stone" />
        </div>
        <ButtonLink href="/" data-track="404-home">
          <ArrowLeftIcon />
          Back to the home page
        </ButtonLink>
      </div>
    </DocumentWindow>
  );
}
