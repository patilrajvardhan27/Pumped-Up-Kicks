import { ButtonLink } from '@/components/ui/Button';
import { ArrowRightIcon } from '@/components/ui/icons';
import { Reveal } from './Reveal';

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-heading" className="px-4 pb-10 sm:px-8">
      <Reveal className="flex flex-col items-start gap-5 border-t border-hairline pt-12 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="closing-heading" className="text-display-md text-ink">
          Stop scrubbing. Start asking.
        </h2>
        <ButtonLink href="/app" data-track="closing-open-workspace">
          Open the workspace
          <ArrowRightIcon />
        </ButtonLink>
      </Reveal>
    </section>
  );
}
