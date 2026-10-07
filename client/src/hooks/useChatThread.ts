'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatService } from '@/services/chatService';
import type { ConversationDetail } from '@/types/api';
import type { Turn } from '@/types/chat';

interface Thread {
  /** The conversation these turns belong to; null is an unsaved new chat. */
  id: number | null;
  turns: Turn[];
}

function restoreTurns(detail: ConversationDetail): Turn[] {
  const restored: Turn[] = [];
  for (let i = 0; i < detail.messages.length; i += 1) {
    const message = detail.messages[i];
    if (message.role !== 'user') continue;
    const reply = detail.messages[i + 1];
    restored.push({
      key: `m${message.id}`,
      question: message.content,
      answer: reply?.role === 'assistant' ? reply.content : '',
      // Citations come back from the database, so they survive a reload.
      sources: reply?.sources ?? [],
      costUsd: reply?.cost_usd ?? null,
      streaming: false,
    });
  }
  return restored;
}

/**
 * Holds the turns on screen and loads an existing thread when one is opened.
 *
 * Turns are tagged with the conversation they belong to. A chat this pane
 * started is adopted under its new id as soon as the server assigns one, so it
 * is never refetched mid-stream, which would replace the answer being written
 * with nothing: messages are only persisted once the stream finishes.
 */
export function useChatThread(conversationId: number | null) {
  const [thread, setThread] = useState<Thread>({ id: null, turns: [] });
  const current = thread.id === conversationId;

  useEffect(() => {
    if (conversationId == null || thread.id === conversationId) return;

    let cancelled = false;
    chatService
      .getConversation(conversationId)
      .then((detail) => {
        if (!cancelled) setThread({ id: conversationId, turns: restoreTurns(detail) });
      })
      .catch(() => {
        if (!cancelled) setThread({ id: conversationId, turns: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, thread.id]);

  const append = useCallback(
    (turn: Turn) =>
      setThread((prev) => ({
        id: conversationId,
        turns: [...(prev.id === conversationId ? prev.turns : []), turn],
      })),
    [conversationId],
  );

  const patch = useCallback(
    (key: string, change: (turn: Turn) => Turn) =>
      setThread((prev) => ({
        ...prev,
        turns: prev.turns.map((turn) => (turn.key === key ? change(turn) : turn)),
      })),
    [],
  );

  const remove = useCallback(
    (key: string) =>
      setThread((prev) => ({ ...prev, turns: prev.turns.filter((turn) => turn.key !== key) })),
    [],
  );

  const adopt = useCallback((id: number) => setThread((prev) => ({ ...prev, id })), []);

  return {
    turns: current ? thread.turns : [],
    loading: conversationId != null && !current,
    append,
    patch,
    remove,
    adopt,
  };
}
