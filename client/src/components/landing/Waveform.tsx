import { cn } from '@/lib/cn';
import { WAVEFORM } from './hero-timeline-data';

/** A static audio waveform, drawn as bars. Decorative. */
export function Waveform({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className="absolute inset-0 flex items-center gap-px px-1">
      {WAVEFORM.map((height, index) => (
        <span
          key={index}
          className={cn('min-w-0 flex-1 rounded-full', className)}
          style={{ height: `${height * 0.7}%` }}
        />
      ))}
    </span>
  );
}
