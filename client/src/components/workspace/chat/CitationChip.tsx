import { PlayIcon } from '@/components/ui/icons';

interface CitationChipProps {
  label: string;
  /** Omitted when the citation could not be matched to a lecture. */
  onPlay?: () => void;
}

const BASE = 'mx-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 align-baseline font-mono text-code-xs tabular-nums';

/** A [12:04] citation. When it resolves to a lecture it plays from that moment. */
export function CitationChip({ label, onPlay }: CitationChipProps) {
  if (!onPlay) {
    return <span className={`${BASE} bg-surface-soft text-ink`}>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play from ${label}`}
      className={`${BASE} bg-surface-dark text-on-dark transition-transform hover:text-primary active:scale-95`}
    >
      <PlayIcon className="size-2.5" />
      {label}
    </button>
  );
}
