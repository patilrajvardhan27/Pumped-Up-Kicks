'use client';

import { useState } from 'react';
import { CanvasIcon, ChatsIcon, DeadlineIcon, PlayIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { safeUrl } from '@/lib/timestamps';
import type { ConversationItem, Deadline, VideoInfo } from '@/types/api';
import { VIDEO_DRAG, startDrag } from './dnd';

const RECENT_CHATS = 3;
const DUE_SHOWN = 3;
const SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** One line in the tree: a lecture or a chat. Selected reads in navy on the blue wash. */
const treeItemClass = (selected: boolean) =>
  cn(
    'flex min-h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left',
    selected ? 'bg-blue-wash text-label text-ink-navy' : 'text-caption text-slate-gray hover:bg-pebble',
  );

/** "Fri 18 Oct, 11:59 PM", in the student's own time zone. */
function dueLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

/** The next deadline when it is under three days away, with "due today", "due tomorrow" or "due in 3d". */
export function useUrgentDeadline(deadlines: Deadline[]): { deadline: Deadline; label: string } | null {
  const [now] = useState(() => Date.now());
  const next = deadlines[0];
  if (!next || new Date(next.due_at).getTime() - now >= SOON_MS) return null;
  const days = Math.floor((new Date(next.due_at).getTime() - now) / (24 * 60 * 60 * 1000));
  return { deadline: next, label: days <= 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due in ${days}d` };
}

interface RowTreeProps {
  id: string;
  label: string;
  expanded: boolean;
  videos: VideoInfo[];
  documentCount: number;
  deadlines: Deadline[];
  conversations: ConversationItem[];
  selectedVideoId: number | null;
  activeConversationId: number | null;
  onOpenLecture: (video: VideoInfo) => void;
  onOpenConversation: (conversation: ConversationItem) => void;
}

/** Under an open subject: its lectures (draggable to another subject), Canvas material, deadlines and recent chats. */
export function RowTree(props: RowTreeProps) {
  const { id, label, expanded, videos, documentCount, deadlines, conversations } = props;
  const recent = conversations.slice(0, RECENT_CHATS);
  const section = 'mt-1 flex flex-col border-t border-pebble pt-1';

  return (
    <div id={id} hidden={!expanded} className="mt-0.5 mb-1 ml-4 border-l border-pebble pl-1.5">
      {videos.length === 0 ? (
        documentCount === 0 && <p className="px-2 py-1.5 text-caption text-slate-gray">No lectures yet</p>
      ) : (
        <ul aria-label={`Lectures in ${label}`} className="flex flex-col">
          {videos.map((video) => {
            const title = video.title || video.filename;
            const ready = video.stage === 'ready';
            return (
              <li key={video.id} draggable onDragStart={(event) => startDrag(event, VIDEO_DRAG, video.id, title)}>
                <button
                  type="button"
                  onClick={() => props.onOpenLecture(video)}
                  disabled={!ready}
                  aria-current={video.id === props.selectedVideoId ? 'true' : undefined}
                  title={ready ? title : `${title}: ${video.stage_label}`}
                  className={cn(treeItemClass(video.id === props.selectedVideoId), !ready && 'hover:bg-transparent')}
                >
                  <PlayIcon className="size-2.5" />
                  <span className="truncate">{title}</span>
                  {!ready && <span className="ml-auto shrink-0">{video.stage === 'failed' ? 'Failed' : 'Processing'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {documentCount > 0 && (
        <p className="flex min-h-8 items-center gap-2 px-2 text-caption text-slate-gray">
          <CanvasIcon className="size-3.5" />
          {documentCount} from Canvas
        </p>
      )}

      {deadlines.length > 0 && (
        <ul aria-label={`Due soon in ${label}`} className={section}>
          {deadlines.slice(0, DUE_SHOWN).map((deadline) => {
            const href = safeUrl(deadline.url);
            const row = 'flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left text-caption';
            const content = (
              <>
                <DeadlineIcon className="size-3.5 text-slate-gray" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink-navy">{deadline.title}</span>
                  <span className="block text-slate-gray">
                    <time dateTime={deadline.due_at}>{dueLabel(deadline.due_at)}</time>
                    {deadline.is_quiz ? ', quiz' : ''}
                  </span>
                </span>
              </>
            );
            return (
              <li key={deadline.id}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={cn(row, 'no-underline hover:bg-pebble')}>
                    {content}
                    <span className="sr-only"> (opens Canvas in a new tab)</span>
                  </a>
                ) : (
                  <div className={row}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <ul aria-label={`Recent chats in ${label}`} className={section}>
          {recent.map((conversation) => {
            const title = conversation.title || 'Untitled chat';
            const current = conversation.id === props.activeConversationId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => props.onOpenConversation(conversation)}
                  aria-current={current ? 'true' : undefined}
                  title={title}
                  className={treeItemClass(current)}
                >
                  <ChatsIcon className="size-3.5" />
                  <span className="truncate">{title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
