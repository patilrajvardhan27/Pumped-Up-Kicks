import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ProductCard } from './ProductStage';

/* Static product previews for the feature blocks. One row primitive, three arrangements. */

function Row({ lead, label, meta, selected }: { lead: ReactNode; label: string; meta?: string; selected?: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3',
        selected ? 'border-signal-blue bg-blue-wash' : 'border-hairline bg-paper',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pebble text-label text-ink-navy">
        {lead}
      </span>
      <span className="min-w-0 flex-1 truncate text-label text-ink-navy">{label}</span>
      {meta && <span className="shrink-0 text-caption text-slate-gray tabular-nums">{meta}</span>}
    </li>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <ProductCard className="p-6">
      <p className="mb-4 text-title-sm text-ink-navy">{title}</p>
      <ul className="flex flex-col gap-2">{children}</ul>
    </ProductCard>
  );
}

const VISUALS = {
  study: (
    <Frame title="Study guide: Lecture 7">
      <Row lead="1" label="Why depth makes training hard" meta="3:10" />
      <Row lead="2" label="Vanishing gradients" meta="12:04" selected />
      <Row lead="3" label="Residual connections" meta="24:15" />
      <Row lead="4" label="Batch normalisation" meta="38:27" />
    </Frame>
  ),
  course: (
    <Frame title="Deep Learning">
      <Row lead="L7" label="Training deep networks" meta="58 min" selected />
      <Row lead="L6" label="Optimisers" meta="54 min" />
      <Row lead="PDF" label="Week 7 slides" meta="32 pp" />
      <Row lead="Due" label="Assignment 3: CNNs" meta="Fri" />
    </Frame>
  ),
  privacy: (
    <Frame title="Your data">
      <Row lead="✓" label="Visible only to you" selected />
      <Row lead="↓" label="Download everything" meta="JSON" />
      <Row lead="×" label="Delete account and all data" />
    </Frame>
  ),
};

export function FeatureVisual({ kind }: { kind: keyof typeof VISUALS }) {
  return VISUALS[kind];
}
