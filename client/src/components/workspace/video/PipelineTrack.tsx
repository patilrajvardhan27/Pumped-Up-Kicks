import { cn } from '@/lib/cn';
import type { VideoInfo, VideoStage } from '@/types/api';

/**
 * The pipeline every upload runs through. It is a real sequence, so it is
 * shown in order and a student can see exactly which step they are waiting on.
 */
const PIPELINE: { stage: VideoStage; label: string }[] = [
  { stage: 'queued', label: 'Queued' },
  { stage: 'transcribing', label: 'Transcribing' },
  { stage: 'indexing', label: 'Indexing' },
  { stage: 'ready', label: 'Ready' },
];

export function PipelineTrack({ video }: { video: VideoInfo }) {
  if (video.stage === 'failed') {
    return <p className="text-caption text-danger">Processing failed</p>;
  }

  const currentIndex =
    video.stage === 'ready'
      ? PIPELINE.length
      : PIPELINE.findIndex((step) => step.stage === video.stage);

  return (
    <ol aria-label="Processing progress" className="grid grid-cols-4 gap-1.5">
      {PIPELINE.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;

        return (
          <li
            key={step.stage}
            aria-current={active ? 'step' : undefined}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'block h-1.5 rounded-full',
                done ? 'bg-success' : active ? 'animate-pulse-dot bg-signal-blue' : 'bg-pebble',
              )}
            />
            <span
              className={cn(
                'truncate',
                active ? 'text-caption-strong text-ink-navy' : 'text-caption text-slate-gray',
              )}
            >
              {step.label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
