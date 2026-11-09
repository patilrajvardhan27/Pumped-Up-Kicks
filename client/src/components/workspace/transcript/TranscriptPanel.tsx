'use client';

import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Input } from '@/components/ui/Input';
import { useTranscript } from '@/hooks/useTranscript';
import { formatClock } from '@/lib/format';
import type { SeekHandler } from '@/types/chat';

interface TranscriptPanelProps {
  videoId: number;
  onSeek?: SeekHandler;
}

/** Highlights every case-insensitive occurrence of `query` in `text`. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    <>
      {text.split(new RegExp(`(${escaped})`, 'gi')).map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-primary/30 text-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * The whole lecture as text. Search it like a document; click a timestamp to
 * jump the player there. No AI involved, so it costs nothing to use.
 */
export function TranscriptPanel({ videoId, onSeek }: TranscriptPanelProps) {
  const transcript = useTranscript(videoId);
  const [query, setQuery] = useState('');
  const needle = query.trim();

  const lines = useMemo(
    () =>
      needle
        ? transcript.lines.filter((line) => line.text.toLowerCase().includes(needle.toLowerCase()))
        : transcript.lines,
    [transcript.lines, needle],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        id="transcript-search"
        label="Search the transcript"
        labelHidden
        type="search"
        placeholder="Search the transcript…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        helperText={needle ? `${lines.length} matching passage${lines.length === 1 ? '' : 's'}` : undefined}
      />

      {transcript.status === 'error' && (
        <Alert tone="danger" title="Could not load the transcript">
          {transcript.message}
        </Alert>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {transcript.status === 'loading' ? (
          <p className="py-6 text-body-xs text-mute-strong">Loading transcript…</p>
        ) : (
          <ol className="flex flex-col gap-4 py-1">
            {lines.map((line) => (
              <li key={line.start} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
                <button
                  type="button"
                  onClick={() => onSeek?.(videoId, line.start)}
                  className="self-start rounded-sm text-left font-mono text-code-xs tabular-nums text-link-blue hover:underline"
                  aria-label={`Play from ${formatClock(line.start)}`}
                >
                  {formatClock(line.start)}
                </button>
                <p className="text-body-sm text-body">
                  <Highlighted text={line.text} query={needle} />
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
