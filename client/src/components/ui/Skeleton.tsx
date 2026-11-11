import { cn } from '@/lib/cn';

const WIDTHS = ['w-full', 'w-11/12', 'w-2/3', 'w-4/5'];

/** One placeholder bar. It rests as a flat block when motion is reduced. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block h-4 animate-pulse-dot rounded-md bg-pebble', className)} />;
}

interface SkeletonLinesProps {
  /** What is loading, read out to screen readers. */
  label: string;
  lines?: number;
  className?: string;
}

/** Lines of text-shaped placeholder, for content that will arrive as a paragraph. */
export function SkeletonLines({ label, lines = 3, className }: SkeletonLinesProps) {
  return (
    <div role="status" className={cn('flex flex-col gap-2', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={index === lines - 1 ? 'w-1/2' : WIDTHS[index % WIDTHS.length]} />
      ))}
    </div>
  );
}

/** Stacked rows shaped like list items (a lecture, a chat). */
export function SkeletonRows({ label, rows = 3, rowClassName }: { label: string; rows?: number; rowClassName?: string }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={cn('h-14 rounded-lg', rowClassName)} />
      ))}
    </div>
  );
}
