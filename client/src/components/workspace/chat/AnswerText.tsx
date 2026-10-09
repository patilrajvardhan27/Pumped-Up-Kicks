import {
  CITATION_SPLIT,
  docNumber,
  documentLabel,
  parseClock,
  resolveCitation,
  resolveDocument,
  safeUrl,
} from '@/lib/timestamps';
import type { Source } from '@/types/api';
import type { SeekHandler } from '@/types/chat';
import { CitationChip } from './CitationChip';

interface AnswerTextProps {
  text: string;
  sources: Source[];
  onSeek?: SeekHandler;
}

const IS_CITATION = /^\[(\d|Doc\s)/;

/**
 * Renders the model's answer as plain text, with [12:04] citations turned into
 * chips that play the lecture and [Doc 3] citations into chips that open the
 * document. Nothing here is parsed as HTML.
 */
export function AnswerText({ text, sources, onSeek }: AnswerTextProps) {
  return (
    <p className="whitespace-pre-wrap text-body-md text-ink">
      {text.split(CITATION_SPLIT).map((part, index) => {
        if (!part || !IS_CITATION.test(part)) return part;

        const doc = docNumber(part);
        if (doc !== null) {
          const source = resolveDocument(doc, sources);
          return source ? (
            <CitationChip
              key={index}
              kind="document"
              label={documentLabel(source)}
              href={safeUrl(source.url) ?? undefined}
            />
          ) : (
            <CitationChip key={index} kind="document" label={part.slice(1, -1)} />
          );
        }

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
