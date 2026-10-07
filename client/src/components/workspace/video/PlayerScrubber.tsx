import { formatClock } from '@/lib/format';

interface PlayerScrubberProps {
  currentTime: number;
  duration: number;
  /** The passages an answer cited, marked along the bottom edge. */
  citations: { start: number; end: number }[];
  onSeek: (seconds: number) => void;
}

const STEP_SECONDS = 5;

/** The scrubber is the lecture timeline: ribs, cited passages and the needle. */
export function PlayerScrubber({ currentTime, duration, citations, onSeek }: PlayerScrubberProps) {
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const targets: Record<string, number> = {
      ArrowRight: currentTime + STEP_SECONDS,
      ArrowLeft: currentTime - STEP_SECONDS,
      Home: 0,
      End: duration,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    onSeek(targets[event.key]);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatClock(currentTime)} of ${formatClock(duration)}`}
      onClick={(event) => {
        if (!duration) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - bounds.left) / bounds.width) * duration);
      }}
      onKeyDown={handleKeyDown}
      className="strip-ribs relative h-10 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-md bg-surface-dark"
    >
      {duration > 0 &&
        citations.map((citation, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="absolute bottom-0 h-1 rounded-full bg-primary"
            style={{
              left: `${Math.min(100, (citation.start / duration) * 100)}%`,
              width: `${Math.max(1, ((citation.end - citation.start) / duration) * 100)}%`,
            }}
          />
        ))}

      {/* The needle rides a full-width carrier, so it moves by transform alone. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0.5 left-0 transition-transform ease-linear"
        style={{ transform: `translateX(${progress}%)` }}
      >
        <span className="absolute inset-y-0 left-0 w-0.5 bg-on-dark" />
      </span>
    </div>
  );
}
