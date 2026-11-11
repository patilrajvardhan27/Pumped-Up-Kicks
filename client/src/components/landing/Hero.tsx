import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { AnswerCard } from './AnswerCard';
import { HERO, SOURCES } from './content';
import { ProductStage } from './ProductStage';

/** Two columns: the 80px headline and actions on the left, the product on its blobs on the right. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="page grid items-center gap-12 pt-12 pb-16 lg:grid-cols-[1fr_1.1fr] lg:pt-20">
      <div className="flex flex-col items-start gap-6">
        <Badge>{HERO.badge}</Badge>
        <h1 id="hero-title" className="text-heading-sm text-ink-navy sm:text-heading-lg xl:text-display">
          {HERO.title}
        </h1>
        <p className="measure-narrow text-body-lg text-slate-gray">{HERO.body}</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <ButtonLink href={HERO.primary.href} data-track="hero-start">
            {HERO.primary.label}
          </ButtonLink>
          <ButtonLink href={HERO.secondary.href} variant="secondary" data-track="hero-how">
            {HERO.secondary.label}
          </ButtonLink>
        </div>
        <p className="text-caption text-slate-gray">{HERO.note}</p>
      </div>

      <ProductStage>
        <AnswerCard />
      </ProductStage>
    </section>
  );
}

/**
 * Where recordings come from: plain monochrome names floating on the canvas.
 * Slate rather than mist: these are words, not logo images, so they must stay readable.
 */
export function TrustStrip() {
  return (
    <section aria-label="Works with recordings from" className="page flex flex-col items-center gap-4 pb-12">
      <p className="text-caption-strong tracking-wide text-slate-gray uppercase">Works with recordings from</p>
      <ul className="flex flex-wrap justify-center gap-x-10 gap-y-3">
        {SOURCES.map((source) => (
          <li key={source} className="text-title-sm text-slate-gray">
            {source}
          </li>
        ))}
      </ul>
    </section>
  );
}
