import type { RefCallback } from 'react';
import { DisclosureIcon, ExternalIcon, PlayIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { pluralise } from '@/lib/format';
import { safeUrl } from '@/lib/timestamps';
import type { Source } from '@/types/api';
import type { SeekHandler } from '@/types/chat';

interface SourceListProps {
  sources: Source[];
  activeIndex: number | null;
  /** Lets the turn scroll a specific excerpt into view. */
  registerItem: (index: number) => RefCallback<HTMLLIElement>;
  onSeek?: SeekHandler;
}

/** The lecture and course-material excerpts an answer was drawn from, collapsed by default. */
export function SourceList({ sources, activeIndex, registerItem, onSeek }: SourceListProps) {
  return (
    <details className="group/sources">
      <summary className="inline-flex min-h-8 list-none items-center gap-2 rounded-sm text-caption-md text-ink hover:underline [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="inline-block transition-transform group-open/sources:rotate-90"
        >
          <DisclosureIcon className="size-3" />
        </span>
        Read {pluralise(sources.length, 'excerpt')}
      </summary>

      <ul className="mt-3 flex flex-col gap-2">
        {sources.map((source, index) => (
          <li
            key={source.chunk_id ?? index}
            ref={registerItem(index)}
            className={cn(
              'rounded-md border bg-surface-doc p-4',
              activeIndex === index ? 'border-ink' : 'border-hairline',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              {source.kind === 'document' ? (
                <DocumentLink source={source} />
              ) : onSeek && typeof source.video_id === 'number' ? (
                <SeekButton source={source} videoId={source.video_id} onSeek={onSeek} />
              ) : (
                <span className="font-mono text-code-xs tabular-nums text-ink">{source.timestamp}</span>
              )}
              <span className="min-w-0 truncate text-caption-sm text-mute-strong">
                {source.ref ? `${source.ref}: ` : ''}
                {source.video}
              </span>
            </div>
            <p className="text-body-xs font-normal text-body">{source.text}</p>
            {typeof source.similarity === 'number' && (
              <p className="mt-2 font-mono text-code-xs tabular-nums text-mute-strong">
                match {(source.similarity * 100).toFixed(0)}%
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function DocumentLink({ source }: { source: Source }) {
  const href = safeUrl(source.url);
  const label = source.timestamp || 'Open';
  if (!href) {
    return <span className="font-mono text-code-xs tabular-nums text-ink">{source.timestamp || 'Document'}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${source.document_title ?? source.video}${source.timestamp ? `, ${source.timestamp}` : ''} (new tab)`}
      className="focus-on-dark inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-surface-dark px-1.5 py-0.5 font-mono text-code-xs tabular-nums text-on-dark no-underline transition-transform hover:text-primary active:scale-95"
    >
      <ExternalIcon className="size-3" />
      {label}
    </a>
  );
}

function SeekButton({
  source,
  videoId,
  onSeek,
}: {
  source: Source;
  videoId: number;
  onSeek: SeekHandler;
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(videoId, source.start ?? 0)}
      aria-label={`Play from ${source.timestamp}`}
      className="inline-flex items-center gap-1.5 rounded-sm bg-surface-dark px-1.5 py-0.5 font-mono text-code-xs tabular-nums text-on-dark transition-transform hover:text-primary active:scale-95"
    >
      <PlayIcon className="size-2.5" />
      {source.timestamp}
    </button>
  );
}
