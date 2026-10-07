'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ChatsIcon, CloseIcon, PlusIcon } from '@/components/ui/icons';
import { useConversations } from '@/hooks/useConversations';
import { cn } from '@/lib/cn';
import { formatRelativeTime, pluralise } from '@/lib/format';
import type { ConversationItem } from '@/types/api';

interface ConversationListProps {
  /** Null shows every thread; a number scopes to one lecture. */
  videoId: number | null;
  activeId: number | null;
  refreshTrigger?: number;
  onSelect: (id: number | null, videoId?: number | null) => void;
}

function summary(conversation: ConversationItem, showLecture: boolean): string {
  const parts = [
    pluralise(Math.floor(conversation.message_count / 2), 'question'),
    formatRelativeTime(conversation.updated_at),
  ];
  if (showLecture && conversation.video_title) parts.push(conversation.video_title);
  return parts.join(', ');
}

export function ConversationList({ videoId, activeId, refreshTrigger, onSelect }: ConversationListProps) {
  const { conversations, loading, remove } = useConversations(videoId, refreshTrigger);

  const confirmRemove = async (id: number) => {
    if (!window.confirm('Delete this chat? The lecture itself stays in your library.')) return;
    await remove(id);
    if (activeId === id) onSelect(null);
  };

  return (
    <Card as="section" padding="tile" aria-labelledby="chats-heading" className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="chats-heading" className="flex min-w-0 items-center gap-2 text-heading-sm text-ink">
          <ChatsIcon className="size-5" />
          {videoId ? 'Chats about this lecture' : 'Recent chats'}
        </h2>
        <Button variant="tertiary" size="sm" onClick={() => onSelect(null)}>
          <PlusIcon className="size-3.5" />
          New
        </Button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-body-xs text-mute-strong">Loading…</p>
      ) : conversations.length === 0 ? (
        <p className="py-4 text-center text-body-xs text-body">
          No chats yet. Ask a question to start one.
        </p>
      ) : (
        <ul className="-mx-2 flex flex-col gap-1">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            const title = conversation.title || 'Untitled chat';

            return (
              <li
                key={conversation.id}
                className={cn(
                  'relative flex items-center gap-1 rounded-md py-1.5 pr-1 pl-3',
                  active ? 'bg-surface-soft' : 'hover:bg-surface-doc',
                )}
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id, conversation.video_id)}
                    aria-current={active ? 'true' : undefined}
                    title={title}
                    className={cn(
                      'block max-w-full truncate rounded-sm text-left text-body-xs text-ink after:absolute after:inset-0 after:rounded-md',
                      active && 'font-bold',
                    )}
                  >
                    {title}
                  </button>
                  <p className="truncate text-caption-sm text-mute-strong">
                    {summary(conversation, !videoId)}
                  </p>
                </div>

                <IconButton
                  tone="danger"
                  aria-label={`Delete chat: ${title}`}
                  onClick={() => confirmRemove(conversation.id)}
                  className="relative"
                >
                  <CloseIcon />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
