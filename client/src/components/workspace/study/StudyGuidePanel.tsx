'use client';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { SpinnerIcon } from '@/components/ui/icons';
import { CitationChip } from '@/components/workspace/chat/CitationChip';
import { useStudyGuide } from '@/hooks/useStudy';
import { formatClock, formatUsd } from '@/lib/format';
import type { SeekHandler } from '@/types/chat';

interface StudyGuidePanelProps {
  videoId: number;
  title: string;
  onSeek?: SeekHandler;
}

/** A lecture's summary, key terms and outline. Made once on request, then kept. */
export function StudyGuidePanel({ videoId, title, onSeek }: StudyGuidePanelProps) {
  const { guide, loading, making, error, make } = useStudyGuide(videoId);
  const seek = (seconds: number) => onSeek?.(videoId, seconds);

  if (loading) return <p className="py-6 text-body-xs text-mute-strong">Loading…</p>;

  if (!guide) {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <h2 className="text-display-lg text-ink">Study guide for {title}</h2>
        <p className="max-w-[60ch] text-body-sm text-body">
          A summary, the key terms with where each is explained, and an outline you can jump through. It is
          made once from the whole transcript and kept, so opening it again costs nothing.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button onClick={make} disabled={making}>
          {making ? (
            <>
              <SpinnerIcon />
              Reading the lecture…
            </>
          ) : (
            'Make the study guide'
          )}
        </Button>
        {making && <p className="text-caption-sm text-mute-strong">This can take up to a minute.</p>}
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-6 py-2">
      <section aria-labelledby="guide-summary" className="flex flex-col gap-2">
        <h2 id="guide-summary" className="text-heading-sm text-ink">
          Summary
        </h2>
        <p className="max-w-[70ch] text-body-md text-ink">{guide.summary}</p>
        {guide.covered_until_s != null && (
          <p className="text-caption-sm text-mute-strong">
            The lecture was too long to read whole; this guide covers up to {formatClock(guide.covered_until_s)}.
          </p>
        )}
      </section>

      <section aria-labelledby="guide-outline" className="flex flex-col gap-2">
        <h2 id="guide-outline" className="text-heading-sm text-ink">
          Outline
        </h2>
        <ol className="flex flex-col">
          {guide.outline.map((entry) => (
            <li key={entry.start} className="flex min-h-10 items-center gap-3 border-b border-hairline-soft last:border-b-0">
              <CitationChip label={formatClock(entry.start)} onPlay={onSeek ? () => seek(entry.start) : undefined} />
              <span className="text-body-sm text-ink">{entry.title}</span>
            </li>
          ))}
        </ol>
      </section>

      {guide.key_terms.length > 0 && (
        <section aria-labelledby="guide-terms" className="flex flex-col gap-2">
          <h2 id="guide-terms" className="text-heading-sm text-ink">
            Key terms
          </h2>
          <dl className="flex flex-col gap-3">
            {guide.key_terms.map((term) => (
              <div key={term.term} className="flex flex-col gap-0.5">
                <dt className="flex flex-wrap items-center gap-1 text-body-strong text-ink">
                  {term.term}
                  {term.start != null && (
                    <CitationChip
                      label={formatClock(term.start)}
                      onPlay={onSeek ? () => seek(term.start as number) : undefined}
                    />
                  )}
                </dt>
                <dd className="max-w-[70ch] text-body-sm text-body">{term.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {guide.cost_usd != null && (
        <p className="font-mono text-code-xs tabular-nums text-mute-strong">Made once for {formatUsd(guide.cost_usd, 4)}</p>
      )}
    </article>
  );
}
