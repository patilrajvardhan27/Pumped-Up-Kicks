'use client';

import type { Source } from '@/types/api';

interface TapeStripProps {
  sources: Source[];
  /** Known runtime per video filename, when the library has it. */
  durations?: Record<string, number>;
  activeIndex?: number | null;
  onSelect?: (index: number) => void;
}

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * The tape strip: each answer's citations plotted on the lecture's own runtime,
 * so you can see whether it drew on one passage or the whole hour before you
 * read a word of it.
 */
export default function TapeStrip({
  sources,
  durations = {},
  activeIndex = null,
  onSelect,
}: TapeStripProps) {
  const cited = sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => typeof source.start === 'number');

  if (cited.length === 0) return null;

  const videos = Array.from(new Set(cited.map(({ source }) => source.video)));

  return (
    <div className="space-y-4">
      <p className="eyebrow">Where this came from</p>

      {videos.map((video) => {
        const marks = cited.filter(({ source }) => source.video === video);
        const latest = Math.max(...marks.map(({ source }) => source.end ?? source.start ?? 0));
        // Without a known runtime, extend past the last citation so a mark near
        // the end doesn't sit flush against the edge.
        const runtime = durations[video] ?? Math.max(latest * 1.15, 1);

        return (
          <div key={video} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-xs text-muted">{video}</span>
              <span className="shrink-0 font-mono text-xs text-faint">
                {durations[video] ? formatClock(durations[video]) : `~${formatClock(latest)}`}
              </span>
            </div>

            <div className="relative h-11 rounded-md border border-line bg-well">
              {/* Tape ribs: a static texture that reads as magnetic tape. */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-md opacity-[0.35]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, rgba(233,240,245,0.10) 0 1px, transparent 1px 9px)',
                }}
              />

              {marks.map(({ source, index }) => {
                const left = Math.min(97, Math.max(1, ((source.start ?? 0) / runtime) * 100));
                const isActive = activeIndex === index;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelect?.(index)}
                    aria-label={`Excerpt at ${source.timestamp} in ${video}`}
                    className="group absolute top-0 h-full -translate-x-1/2 px-2"
                    style={{ left: `${left}%` }}
                  >
                    <span
                      className={`block h-full w-[3px] rounded-full transition-all duration-200 ${
                        isActive
                          ? 'bg-signal-bright shadow-needle'
                          : 'bg-signal/70 group-hover:bg-signal-bright'
                      }`}
                    />
                    <span
                      className={`pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap
                                  rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[0.65rem]
                                  text-signal transition-opacity duration-150 ${
                                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                  }`}
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
