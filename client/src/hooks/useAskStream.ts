'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { ApiError } from '@/services/api';
import { chatService } from '@/services/chatService';
import type { ChatRequest, StreamEvent } from '@/types/api';
import type { Turn } from '@/types/chat';

/** What a new chat searches. An existing thread keeps its own scope. */
export type NewChatScope = Pick<ChatRequest, 'scope' | 'video_id' | 'workspace_id'>;

interface AskStreamOptions {
  scope: NewChatScope;
  conversationId: number | null;
  append: (turn: Turn) => void;
  patch: (key: string, change: (turn: Turn) => Turn) => void;
  remove: (key: string) => void;
  adopt: (conversationId: number) => void;
  onConversationStarted: (id: number) => void;
  onTurnComplete: () => void;
}

const TOP_K = 5;

/** Sends a question and streams the answer into its turn. */
export function useAskStream({
  scope,
  conversationId,
  append,
  patch,
  remove,
  adopt,
  onConversationStarted,
  onTurnComplete,
}: AskStreamOptions) {
  const [busy, setBusy] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      track('question_asked', {
        scope:
          conversationId != null
            ? 'thread'
            : scope.scope === 'video'
              ? 'lecture'
              : scope.scope === 'workspace'
                ? 'subject'
                : 'library',
      });

      const key = `t${Date.now()}`;
      append({ key, question: trimmed, answer: '', sources: [], streaming: true });
      setBusy(true);
      setQuotaError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const update = (change: Partial<Turn>) => patch(key, (turn) => ({ ...turn, ...change }));

      const target = conversationId != null ? { conversation_id: conversationId } : scope;

      const handleEvent = (event: StreamEvent) => {
        if (event.type === 'conversation') {
          if (conversationId == null) {
            adopt(event.conversation_id);
            onConversationStarted(event.conversation_id);
          }
        } else if (event.type === 'sources') {
          update({ sources: event.sources });
        } else if (event.type === 'delta') {
          patch(key, (turn) => ({ ...turn, answer: turn.answer + event.text }));
        } else if (event.type === 'done') {
          update({
            answer: event.answer,
            sources: event.sources,
            usage: event.usage,
            responseTime: event.response_time,
            streaming: false,
          });
        } else if (event.type === 'error') {
          update({ error: event.message, streaming: false });
        }
      };

      try {
        await chatService.streamQuery(
          { question: trimmed, top_k: TOP_K, ...target },
          handleEvent,
          controller.signal,
        );
        onTurnComplete();
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;

        if (err instanceof ApiError && err.status === 402) {
          setQuotaError(err.message);
          remove(key);
        } else {
          update({
            error: err instanceof Error ? err.message : 'The request did not complete.',
            streaming: false,
          });
        }
      } finally {
        update({ streaming: false });
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, conversationId, scope, append, patch, remove, adopt, onConversationStarted, onTurnComplete],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clearQuotaError = useCallback(() => setQuotaError(null), []);

  return { busy, quotaError, clearQuotaError, ask, stop };
}
