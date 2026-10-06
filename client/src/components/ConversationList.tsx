'use client';

import { useCallback, useEffect, useState } from 'react';
import { chatService } from '@/services';
import type { ConversationItem } from '@/types/api';

interface ConversationListProps {
  /** Null shows every thread; a number scopes to one lecture. */
  videoId: number | null;
  activeId: number | null;
  refreshTrigger?: number;
  onSelect: (id: number | null, videoId?: number | null) => void;
}

function questionCount(messageCount: number): string {
  const asked = Math.floor(messageCount / 2);
  return `${asked} question${asked === 1 ? '' : 's'}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1440)}d ago`;
}

export default function ConversationList({
  videoId,
  activeId,
  refreshTrigger,
  onSelect,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setConversations(await chatService.listConversations(videoId));
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  const remove = async (event: React.MouseEvent, id: number) => {
    event.stopPropagation();
    if (!window.confirm('Delete this chat? The lecture itself stays in your library.')) return;

    await chatService.deleteConversation(id).catch(() => undefined);
    if (activeId === id) onSelect(null);
    load();
  };

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-ink">
          {videoId ? 'Chats about this lecture' : 'Recent chats'}
        </h3>
        <button
          onClick={() => onSelect(null)}
          className="font-mono text-[0.65rem] uppercase tracking-wider text-signal
                     transition-opacity hover:opacity-70"
        >
          + New
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center font-mono text-sm text-faint">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">
          No chats yet. Ask a question to start one.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(conversation.id, conversation.video_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(conversation.id, conversation.video_id);
                    }
                  }}
                  className={`group flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5
                              transition-colors ${
                                active
                                  ? 'border-signal/50 bg-signal/[0.07]'
                                  : 'border-transparent hover:border-line hover:bg-well'
                              }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${active ? 'text-signal' : 'text-ink'}`}
                      title={conversation.title ?? undefined}
                    >
                      {conversation.title || 'Untitled chat'}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[0.6rem] text-faint">
                      {questionCount(conversation.message_count)}
                      {' · '}
                      {relativeTime(conversation.updated_at)}
                      {!videoId && conversation.video_title ? ` · ${conversation.video_title}` : ''}
                    </p>
                  </div>

                  <button
                    onClick={(e) => remove(e, conversation.id)}
                    aria-label={`Delete chat: ${conversation.title ?? 'untitled'}`}
                    className="shrink-0 rounded p-1 text-faint opacity-0 transition-all
                               hover:bg-fault/10 hover:text-fault group-hover:opacity-100
                               focus-visible:opacity-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
