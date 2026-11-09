import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ArrowRightIcon, VerifiedIcon } from '@/components/ui/icons';

const PROMISES = [
  'Every answer links to the moment in the video',
  'Claude only sees the passages that match your question',
  'Upload MP4, MOV, MKV or WEBM, up to 4 GB',
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="grid items-center gap-8 px-4 pt-8 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10 lg:pt-12"
    >
      <div className="flex flex-col items-start gap-4">
        <h1 id="hero-heading" className="animate-rise text-display-lg text-ink md:text-display-xl">
          Ask your lecture a question. Jump to the{' '}
          <span className="rounded-sm bg-accent-soft px-1.5 whitespace-nowrap">minute</span> that answers it.
        </h1>
        <p className="stagger max-w-xl animate-rise text-body-md text-body [--i:1]">
          Upload a recording and ask it anything. Every answer cites the exact timestamp, so you
          stop scrubbing.
        </p>
      </div>

      <Card className="stagger flex animate-rise flex-col gap-4 [--i:2]">
        <h2 className="text-heading-lg text-ink">What you can do here</h2>
        <ul className="flex flex-col gap-2">
          {PROMISES.map((promise) => (
            <li key={promise} className="flex items-start gap-2 text-body-sm text-ink">
              <VerifiedIcon className="mt-0.5 text-success" />
              {promise}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <ButtonLink href="/app" block data-track="hero-open-workspace">
            Open workspace
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
