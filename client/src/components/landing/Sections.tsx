import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { CLOSING, type FeatureSection, STEPS } from './content';
import { FeatureList } from './FeatureList';
import { FeatureVisual } from './FeatureVisuals';
import { ProductStage } from './ProductStage';
import { SectionHeader } from './SectionHeader';

/** Three numbered steps under a centered header. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="page section-y flex flex-col gap-12">
      <SectionHeader id="how" eyebrow="How it works" title="From recording to answer in three steps." />
      <ol className="grid gap-8 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-blue-wash text-label text-deep-cobalt">
              {index + 1}
            </span>
            <h3 className="text-title text-ink-navy">{step.title}</h3>
            <p className="text-body text-slate-gray">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Text and accordion on one side, the product on its blobs on the other; alternates by index. */
export function FeatureBlock({ section, reverse }: { section: FeatureSection; reverse?: boolean }) {
  return (
    <section aria-labelledby={section.id} className="page section-y grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={cn('flex flex-col gap-8', reverse && 'lg:order-2')}>
        <SectionHeader id={section.id} eyebrow={section.eyebrow} title={section.title} intro={section.intro} align="left" />
        <FeatureList items={section.items} />
      </div>
      <ProductStage tone={reverse ? 'magenta' : 'cyan'}>
        <FeatureVisual kind={section.visual} />
      </ProductStage>
    </section>
  );
}

/** The inverse band: navy surface, white heading, one primary action. */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing" className="page pb-16">
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-ink-navy px-6 py-16 text-center">
        <h2 id="closing" className="text-heading-sm text-paper lg:text-heading">
          {CLOSING.title}
        </h2>
        <p className="measure-narrow text-body-lg text-mist-gray">{CLOSING.body}</p>
        <ButtonLink href={CLOSING.cta.href} data-track="closing-cta" className="focus-on-dark">
          {CLOSING.cta.label}
        </ButtonLink>
      </div>
    </section>
  );
}
