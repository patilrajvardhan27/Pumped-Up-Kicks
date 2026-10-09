import { CitationChip } from '@/components/workspace/chat/CitationChip';
import { formatClock } from '@/lib/format';
import { documentLabel, safeUrl } from '@/lib/timestamps';
import type { PracticeSource } from '@/types/api';
import type { SeekHandler } from '@/types/chat';

/** Where an answer comes from: plays the lecture moment, or opens the document page. */
export function SourceCitation({ source, onSeek }: { source: PracticeSource; onSeek?: SeekHandler }) {
  if (source.kind === 'document') {
    return (
      <CitationChip
        kind="document"
        label={documentLabel({ ...source, text: '', timestamp: source.timestamp ?? '', video: source.video ?? '' })}
        href={safeUrl(source.url) ?? undefined}
      />
    );
  }

  const start = source.start ?? 0;
  const label = `${source.video ? `${source.video} ` : ''}${formatClock(start)}`;
  return (
    <CitationChip
      label={label}
      onPlay={onSeek && typeof source.video_id === 'number' ? () => onSeek(source.video_id as number, start) : undefined}
    />
  );
}
