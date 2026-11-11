'use client';

import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import type { Source } from '@/types/api';

interface TimelineStripProps {
  sources: Source[];
  /** Known runtime per lecture title, when the library has it. */
  durations?: Record<string, number>;
  activeIndex?: number | null;
  onSelect?: (index: number) => void;
}

/**
 * The product's signature: an answer's citations plotted on the lecture's own
 * runtime, so you can see whether it drew on one passage or the whole hour
 * before reading a word of it. The excerpt you pick is marked in Signal Blue.
 */
export function TimelineStrip({
  sources,
  durations = {},
  activeIndex = null,
  onSelect,
}: TimelineStripProps) {
  const cited = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => typeof source.start === 'number');

  if (cited.length === 0) return null;

  const lectures = Array.from(new Set(cited.map(({ source }) => source.video)));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-button-sm text-ink-navy">Where this came from</p>

      {lectures.map((lecture) => {
        const marks = cited.filter(({ source }) => source.video === lecture);
        const latest = Math.max(...marks.map(({ source }) => source.end ?? source.start ?? 0));
        const known = durations[lecture];
        // Without a known runtime, extend past the last citation so a mark near
        // the end doesn't sit flush against the edge.
        const runtime = known ?? Math.max(latest * 1.15, 1);

        return (
          <div key={lecture} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-caption text-slate-gray">{lecture}</span>
              <span className="shrink-0 tabular-nums text-caption text-slate-gray">
                {known ? formatClock(known) : `~${formatClock(latest)}`}
              </span>
            </div>

            {/* Room above the strip is reserved for the timestamp labels. */}
            <div className="relative mt-7 h-11 rounded-lg border border-hairline bg-pebble">
              {marks.map(({ source, index }) => {
                const left = Math.min(97, Math.max(3, ((source.start ?? 0) / runtime) * 100));
                const active = activeIndex === index;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelect?.(index)}
                    aria-label={`Excerpt at ${source.timestamp} in ${lecture}`}
                    aria-pressed={active}
                    className="group/mark absolute inset-y-0 w-6 -translate-x-1/2 rounded-md focus-visible:outline-inset"
                    style={{ left: `${left}%` }}
                  >
                    <span
                      className={cn(
                        'mx-auto block h-full rounded-full transition-[width,background-color]',
                        active ? 'w-1 bg-signal-blue' : 'w-0.5 bg-ink-navy group-hover/mark:w-1',
                      )}
                    />
                    <span
                      className={cn(
                        'pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md px-1.5 py-0.5',
                        'tabular-nums text-caption whitespace-nowrap transition-opacity',
                        'group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100',
                        active ? 'bg-signal-blue text-paper opacity-100' : 'bg-ink-navy text-paper opacity-0',
                      )}
                    >
                      {source.timestamp}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
