import { Card } from '@/components/ui/Card';
import { CostIcon, MeaningIcon, VerifiedIcon } from '@/components/ui/icons';
import { Reveal } from './Reveal';

const TILE_ICON = 'flex size-11 items-center justify-center rounded-md';

/* What you get out of the pipeline. Not a sequence, so not numbered. */
export function Qualities() {
  return (
    <section id="qualities" aria-labelledby="qualities-heading" className="section-y scroll-mt-6 px-4 pt-0! sm:px-8">
      <h2 id="qualities-heading" className="text-display-lg text-ink">
        A lecture you can interrogate.
      </h2>

      <Reveal stagger className="mt-8 grid gap-4 lg:grid-cols-2 lg:grid-rows-2">
        <Card as="article" className="flex flex-col gap-4 lg:row-span-2 lg:justify-between">
          <span className={`${TILE_ICON} bg-accent-green-soft text-ink`}>
            <VerifiedIcon className="size-6" />
          </span>
          <p aria-hidden="true" className="rounded-md bg-surface-soft p-4 font-mono text-code-sm text-ink">
            The lecture does not cover that.
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="text-heading-md text-ink">Answers you can check</h3>
            <p className="max-w-[52ch] text-body-sm text-body">
              Every claim carries the timestamp it came from. If the lecture never said it, the
              answer says so instead of guessing.
            </p>
          </div>
        </Card>

        <Card as="article" className="flex gap-4">
          <span className={`${TILE_ICON} shrink-0 bg-accent-blue-soft text-ink`}>
            <MeaningIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="text-heading-sm text-ink">Search that reads meaning</h3>
            <p className="text-body-sm text-body">
              Ask in your own words. Matching happens on meaning, not on whether you guessed the
              lecturer&rsquo;s exact phrasing.
            </p>
          </div>
        </Card>

        <article className="flex gap-4 rounded-md bg-surface-dark p-6 text-on-dark">
          <span className={`${TILE_ICON} shrink-0 bg-primary text-on-primary`}>
            <CostIcon className="size-6" />
          </span>
          <div className="flex flex-col gap-2">
            <h3 className="text-heading-sm">Cost you can see</h3>
            <p className="text-body-sm text-stone">
              Token counts and spend sit next to every answer, and a repeated question is served
              from cache.
            </p>
          </div>
        </article>
      </Reveal>
    </section>
  );
}
