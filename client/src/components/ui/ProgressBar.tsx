import { cn } from '@/lib/cn';

interface ProgressBarProps {
  /** 0 to 100. */
  value: number;
  label: string;
  tone?: 'primary' | 'success' | 'danger';
  /** Pulses the fill while work is in progress. */
  busy?: boolean;
}

const TONE = {
  primary: 'bg-signal-blue',
  success: 'bg-success',
  danger: 'bg-danger',
};

/**
 * The fill is always full width and slides in from the left, so progress
 * animates with transform alone and the track never reflows.
 */
export function ProgressBar({ value, label, tone = 'primary', busy = false }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 overflow-hidden rounded-full bg-pebble"
    >
      <div
        className={cn('h-full rounded-full transition-transform duration-300', TONE[tone], busy && 'animate-pulse-dot')}
        style={{ transform: `translateX(${clamped - 100}%)` }}
      />
    </div>
  );
}
