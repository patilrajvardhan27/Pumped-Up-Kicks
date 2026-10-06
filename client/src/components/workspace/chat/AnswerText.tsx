import { CITATION_SPLIT, parseClock, resolveCitation } from '@/lib/timestamps';
import type { Source } from '@/types/api';
import type { SeekHandler } from '@/types/chat';
import { CitationChip } from './CitationChip';

interface AnswerTextProps {
  text: string;
  sources: Source[];
  onSeek?: SeekHandler;
}

const IS_CITATION = /^\[\d/;

/**
 * Renders the model's answer as plain text, with [12:04] citations turned into
 * chips. Nothing here is parsed as HTML.
 */
export function AnswerText({ text, sources, onSeek }: AnswerTextProps) {
  return (
    <p className="whitespace-pre-wrap text-body-md text-ink">
      {text.split(CITATION_SPLIT).map((part, index) => {
        if (!part || !IS_CITATION.test(part)) return part;

        const label = part.slice(1, -1);
        const seconds = parseClock(label.split(/[-–]/)[0]);
        const target = seconds == null ? null : resolveCitation(seconds, sources);

        return (
          <CitationChip
            key={index}
            label={label}
            onPlay={target && onSeek ? () => onSeek(target.videoId, target.seconds) : undefined}
          />
        );
      })}
    </p>
  );
}
