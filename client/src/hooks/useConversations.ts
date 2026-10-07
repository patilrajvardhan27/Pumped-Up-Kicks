'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatService } from '@/services/chatService';
import type { ConversationItem } from '@/types/api';

/** Chat threads, optionally only those about one lecture. */
export function useConversations(videoId: number | null, refreshTrigger?: number) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    chatService
      .listConversations(videoId)
      .then((items) => {
        if (!cancelled) setConversations(items);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, refreshTrigger, reloadCount]);

  /** Deletes a thread. A failed delete is ignored; the list reloads either way. */
  const remove = useCallback(async (id: number) => {
    await chatService.deleteConversation(id).catch(() => undefined);
    setReloadCount((count) => count + 1);
  }, []);

  return { conversations, loading, remove };
}
