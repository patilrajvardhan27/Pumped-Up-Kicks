'use client';

import * as m from 'motion/react-m';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { SNAP_SPRING } from '@/lib/motion';
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
 * before reading a word of it. The lit mark slides to whichever excerpt you pick.
 */
export function TimelineStrip({
  sources,
  durations = {},
  activeIndex = null,
  onSelect,
}: TimelineStripProps) {
  const stripId = useId();
  const cited = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => typeof source.start === 'number');

  if (cited.length === 0) return null;

  const lectures = Array.from(new Set(cited.map(({ source }) => source.video)));

  return (
    <div className="flex flex-col gap-4">
      <p className="eyebrow">Where this came from</p>

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
              <span className="min-w-0 truncate text-caption-sm text-body">{lecture}</span>
              <span className="shrink-0 font-mono text-code-xs tabular-nums text-mute-strong">
                {known ? formatClock(known) : `~${formatClock(latest)}`}
              </span>
            </div>

            {/* Room above the strip is reserved for the timestamp labels. */}
            <div className="strip-ribs relative mt-7 h-11 rounded-md bg-surface-dark">
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
                    className="group/mark focus-on-dark absolute inset-y-0 w-6 -translate-x-1/2 rounded-sm focus-visible:outline-offset-[-2px]"
                    style={{ left: `${left}%` }}
                  >
                    <span className="mx-auto block h-full w-[3px] rounded-full bg-stone transition-transform group-hover/mark:scale-x-150 group-active/mark:scale-y-90" />
                    {active && (
                      <m.span
                        layoutId={`${stripId}-${lecture}-lit`}
                        transition={SNAP_SPRING}
                        className="absolute inset-y-0 left-1/2 -ml-0.5 w-1 rounded-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        'pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-sm px-1.5 py-0.5',
                        'font-mono text-code-xs tabular-nums whitespace-nowrap transition-opacity',
                        'group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100',
                        active ? 'bg-primary text-on-primary opacity-100' : 'bg-surface-dark text-on-dark opacity-0',
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
