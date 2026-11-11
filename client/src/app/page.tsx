import type { Metadata } from 'next';
import { FEATURES } from '@/components/landing/content';
import { Hero, TrustStrip } from '@/components/landing/Hero';
import { ClosingCta, FeatureBlock, HowItWorks } from '@/components/landing/Sections';
import { PageShell } from '@/components/site/PageShell';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <PageShell>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      {FEATURES.map((section, index) => (
        <FeatureBlock key={section.id} section={section} reverse={index % 2 === 1} />
      ))}
      <ClosingCta />
    </PageShell>
  );
}
