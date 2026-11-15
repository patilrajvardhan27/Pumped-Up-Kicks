'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Alert } from '@/components/ui/Alert';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { selectThreadLoading, selectTurns, useAppStore } from '@/stores/appStore';
import type { VideoInfo } from '@/types/api';
import type { NewChatScope, SeekHandler } from '@/types/chat';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatTurn } from './ChatTurn';
import { ExportNotesButton } from './ExportNotesButton';

interface ChatPanelProps {
  /** Every lecture, so citations from any of them can be placed on a timeline. */
  videos: VideoInfo[];
  /** What a new chat searches. */
  scope: NewChatScope;
  /** The open lecture or subject, as the student would name it. */
  scopeLabel: string;
  /** Whether anything in scope is ready to be asked. */
  hasContent: boolean;
  onSeek?: SeekHandler;
}

/** The chat for whatever is open. Its thread and stream lived in the app store. */
export function ChatPanel({ videos, scope, scopeLabel, hasContent, onSeek }: ChatPanelProps) {
  const turns = useAppStore(selectTurns);
  const loading = useAppStore(selectThreadLoading);
  const conversationId = useAppStore((s) => s.conversationId);
  const busy = useAppStore((s) => s.busy);
  const quotaError = useAppStore((s) => s.quotaError);
  const { ask, stop, loadThread, clearQuotaError } = useAppStore.getState();
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Fetched a saved chat when one was opened.
  useEffect(() => {
    if (loading && conversationId != null) void loadThread(conversationId);
  }, [loading, conversationId, loadThread]);

  // Stopped any answer still streaming when the pane went away.
  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  const durations = useMemo(() => {
    const byTitle: Record<string, number> = {};
    videos.forEach((video) => {
      if (video.duration) byTitle[video.title || video.filename] = video.duration;
    });
    return byTitle;
  }, [videos]);

  const askHere = (question: string) => ask(question, scope);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1" tabIndex={-1}>
        {loading ? (
          <SkeletonLines label="Loading chat" lines={4} className="py-6" />
        ) : turns.length === 0 ? (
          <ChatEmptyState hasContent={hasContent} scope={scope.scope ?? 'all'} scopeLabel={scopeLabel} onAsk={askHere} />
        ) : (
          <div className="flex flex-col gap-10 py-2">
            {turns.map((turn) => (
              <ChatTurn key={turn.key} turn={turn} durations={durations} onSeek={onSeek} />
            ))}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {quotaError && (
        <Alert tone="danger" title="Monthly limit reached" onClose={clearQuotaError}>
          {quotaError}
        </Alert>
      )}

      <ExportNotesButton turns={turns} title={scopeLabel} disabled={busy} />

      <ChatComposer
        placeholder={hasContent ? `Ask ${scopeLabel}…` : 'Add a lecture first'}
        disabled={!hasContent || loading}
        busy={busy}
        onAsk={askHere}
        onStop={stop}
      />
    </div>
  );
}
