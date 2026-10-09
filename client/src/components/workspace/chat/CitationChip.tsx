import { PageIcon, PlayIcon } from '@/components/ui/icons';

interface CitationChipProps {
  label: string;
  kind?: 'video' | 'document';
  /** Lecture citations: omitted when the citation could not be matched to a lecture. */
  onPlay?: () => void;
  /** Document citations: where the document opens, in a new tab. */
  href?: string;
}

const BASE = 'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-sm px-1.5 align-baseline font-mono text-code-xs tabular-nums';
const LIVE = `${BASE} bg-surface-dark text-on-dark transition-transform hover:text-primary active:scale-95 focus-on-dark`;

/**
 * A [12:04] citation plays the lecture from that moment. A [Doc 3] citation
 * shows the document and page it came from and opens it.
 */
export function CitationChip({ label, kind = 'video', onPlay, href }: CitationChipProps) {
  if (kind === 'document') {
    if (!href) {
      return <span className={`${BASE} bg-surface-soft text-ink`}>{label}</span>;
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${label} (new tab)`}
        className={`${LIVE} no-underline`}
      >
        <PageIcon className="size-3" />
        <span className="truncate">{label}</span>
      </a>
    );
  }

  if (!onPlay) {
    return <span className={`${BASE} bg-surface-soft text-ink`}>{label}</span>;
  }

  return (
    <button type="button" onClick={onPlay} aria-label={`Play from ${label}`} className={LIVE}>
      <PlayIcon className="size-2.5" />
      {label}
    </button>
  );
}
