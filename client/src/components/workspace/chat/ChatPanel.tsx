'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Alert } from '@/components/ui/Alert';
import { useAskStream } from '@/hooks/useAskStream';
import { useChatThread } from '@/hooks/useChatThread';
import type { Source, VideoInfo } from '@/types/api';
import type { SeekHandler } from '@/types/chat';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatTurn } from './ChatTurn';

interface ChatPanelProps {
  videos: VideoInfo[];
  /** Lecture the conversation is scoped to; null means all lectures. */
  videoId: number | null;
  conversationId: number | null;
  onConversationStarted: (id: number) => void;
  onTurnComplete: () => void;
  onSeek?: SeekHandler;
  /** The latest answer's excerpts, so the player can mark them on its scrubber. */
  onSourcesChange?: (sources: Source[]) => void;
}

export function ChatPanel({
  videos,
  videoId,
  conversationId,
  onConversationStarted,
  onTurnComplete,
  onSeek,
  onSourcesChange,
}: ChatPanelProps) {
  const thread = useChatThread(conversationId);
  const { turns } = thread;
  const stream = useAskStream({
    videoId,
    conversationId,
    append: thread.append,
    patch: thread.patch,
    remove: thread.remove,
    adopt: thread.adopt,
    onConversationStarted,
    onTurnComplete,
  });

  const threadEndRef = useRef<HTMLDivElement>(null);

  const durations = useMemo(() => {
    const byTitle: Record<string, number> = {};
    videos.forEach((video) => {
      if (video.duration) byTitle[video.title || video.filename] = video.duration;
    });
    return byTitle;
  }, [videos]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  // Mark the most recent answer's excerpts on the player's scrubber.
  const latestSources = turns.length ? turns[turns.length - 1].sources : null;
  useEffect(() => {
    if (latestSources) onSourcesChange?.(latestSources);
  }, [latestSources, onSourcesChange]);

  const hasContent = videos.some((video) => video.stage === 'ready');
  const scopeLabel = videoId
    ? videos.find((video) => video.id === videoId)?.title || 'this lecture'
    : 'all your lectures';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1" tabIndex={-1}>
        {thread.loading ? (
          <p className="py-6 text-body-xs text-mute-strong">Loading chat…</p>
        ) : turns.length === 0 ? (
          <ChatEmptyState
            hasContent={hasContent}
            scoped={videoId != null}
            scopeLabel={scopeLabel}
            onAsk={stream.ask}
          />
        ) : (
          <div className="flex flex-col gap-10 py-2">
            {turns.map((turn) => (
              <ChatTurn key={turn.key} turn={turn} durations={durations} onSeek={onSeek} />
            ))}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {stream.quotaError && (
        <Alert tone="danger" title="Monthly limit reached" onClose={stream.clearQuotaError}>
          {stream.quotaError}
        </Alert>
      )}

      <ChatComposer
        placeholder={hasContent ? `Ask ${scopeLabel}…` : 'Add a lecture first'}
        disabled={!hasContent || thread.loading}
        busy={stream.busy}
        onAsk={stream.ask}
        onStop={stream.stop}
      />
    </div>
  );
}
