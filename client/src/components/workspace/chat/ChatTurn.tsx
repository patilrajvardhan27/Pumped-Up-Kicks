'use client';

import { useCallback, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { track } from '@/lib/analytics';
import { TimelineStrip } from '@/components/workspace/video/TimelineStrip';
import type { SeekHandler, Turn } from '@/types/chat';
import { AnswerText } from './AnswerText';
import { SourceList } from './SourceList';
import { TurnMeta } from './TurnMeta';

interface ChatTurnProps {
  turn: Turn;
  durations: Record<string, number>;
  onSeek?: SeekHandler;
}

/** One question and everything that came back for it. */
export function ChatTurn({ turn, durations, onSeek }: ChatTurnProps) {
  const [activeSource, setActiveSource] = useState<number | null>(null);
  const items = useRef(new Map<number, HTMLLIElement>());

  const registerItem = useCallback(
    (index: number) => (element: HTMLLIElement | null) => {
      if (element) items.current.set(index, element);
      else items.current.delete(index);
    },
    [],
  );

  const jumpToSource = (index: number) => {
    const source = turn.sources[index];
    setActiveSource(index);
    track('citation_clicked', { source: 'timeline' });
    items.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (source && onSeek && typeof source.video_id === 'number') {
      onSeek(source.video_id, source.start ?? 0);
    }
  };

  const seekFromAnswer: SeekHandler = (videoId, seconds) => {
    track('citation_clicked', { source: 'answer' });
    onSeek?.(videoId, seconds);
  };

  const settled = !turn.streaming && turn.sources.length > 0;

  return (
    <article className="flex animate-rise flex-col gap-4">
      <h3 className="text-heading-sm text-ink">{turn.question}</h3>

      <div className="flex flex-col gap-5 border-l-2 border-hairline-soft pl-4">
        {turn.error ? (
          <Alert tone="danger" title="Could not answer">
            {turn.error}
          </Alert>
        ) : (
          <>
            <div aria-live="polite" aria-busy={turn.streaming}>
              {turn.answer ? (
                <AnswerText text={turn.answer} sources={turn.sources} onSeek={onSeek && seekFromAnswer} />
              ) : (
                <p className="flex items-center gap-2 text-body-xs text-mute-strong">
                  <span aria-hidden="true" className="size-2 animate-pulse-dot rounded-full bg-ink" />
                  Reading the transcript…
                </p>
              )}
            </div>

            {settled && (
              <>
                <TimelineStrip
                  sources={turn.sources}
                  durations={durations}
                  activeIndex={activeSource}
                  onSelect={jumpToSource}
                />
                <SourceList
                  sources={turn.sources}
                  activeIndex={activeSource}
                  registerItem={registerItem}
                  onSeek={onSeek}
                />
              </>
            )}

            <TurnMeta turn={turn} />
          </>
        )}
      </div>
    </article>
  );
}
