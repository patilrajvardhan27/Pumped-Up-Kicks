import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ArrowRightIcon, VerifiedIcon } from '@/components/ui/icons';

const PROMISES = [
  'Every answer cites the exact timestamp',
  'Only the matching passages are sent to Claude',
  'MP4, MOV, MKV or WEBM, up to 4 GB',
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="grid items-center gap-8 px-4 pt-8 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10 lg:pt-12"
    >
      <div className="flex flex-col items-start gap-4">
        <p className="eyebrow animate-rise">Lecture intelligence</p>
        <h1 id="hero-heading" className="stagger animate-rise text-display-md text-ink [--i:1] md:text-display-xl">
          Rewind your lectures,{' '}
          <span className="rounded-sm bg-primary/30 px-1.5 whitespace-nowrap">fast-forward</span> your
          learning.
        </h1>
        <p className="stagger max-w-xl animate-rise text-body-md text-body [--i:2]">
          Upload a recording and ask it anything. Every answer cites the exact timestamp, so you
          stop scrubbing.
        </p>
      </div>

      <Card className="stagger flex animate-rise flex-col gap-4 [--i:3]">
        <h2 className="text-heading-md text-ink">Start asking in minutes</h2>
        <ul className="flex flex-col gap-2">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex items-start gap-2 text-body-xs text-ink">
              <VerifiedIcon className="mt-0.5 text-accent-green" />
              {promise}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <ButtonLink href="/app" block data-track="hero-open-workspace">
            Open the workspace
            <ArrowRightIcon />
          </ButtonLink>
          <ButtonLink href="#how" variant="secondary" block>
            How it works
          </ButtonLink>
        </div>
      </Card>
    </section>
  );
}
