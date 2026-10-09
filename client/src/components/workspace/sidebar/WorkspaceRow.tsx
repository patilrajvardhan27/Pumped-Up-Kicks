'use client';

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { CanvasIcon, ChatsIcon, DisclosureIcon, EditIcon, PlayIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { WorkspaceKey } from '@/lib/workspaces';
import type { ConversationItem, VideoInfo, WorkspaceInfo } from '@/types/api';
import { VIDEO_DRAG, WORKSPACE_DRAG, carries, draggedId, startDrag } from './dnd';
import { WorkspaceGlyph } from './WorkspaceGlyph';

type DropHint = 'into' | 'before' | 'after' | null;

interface WorkspaceRowProps {
  rowKey: WorkspaceKey;
  /** Present for a subject; absent for All lectures and Unsorted. */
  workspace?: WorkspaceInfo;
  label: string;
  count: number;
  active: boolean;
  expanded: boolean;
  /** 1 to 9: the number that opens this subject with Ctrl or Cmd. */
  shortcut?: number;
  modifierLabel: string;
  videos: VideoInfo[];
  /** Imported Canvas material in this subject. */
  documentCount?: number;
  conversations: ConversationItem[];
  selectedVideoId: number | null;
  activeConversationId: number | null;
  onActivate: () => void;
  onToggle: () => void;
  onOpenLecture: (video: VideoInfo) => void;
  onOpenConversation: (conversation: ConversationItem) => void;
  /** Accept a dragged lecture. Left out where a lecture cannot be filed (All lectures). */
  onDropVideo?: (videoId: number) => void;
  /** Accept a dragged subject, placed before or after this one. */
  onDropWorkspace?: (workspaceId: number, place: 'before' | 'after') => void;
  onEdit?: () => void;
  /** The inline editor, shown under the row while it is open. */
  editor?: ReactNode;
}

const RECENT_CHATS = 3;

/** One subject in the sidebar: the row itself and, when open, its lectures and recent chats. */
export function WorkspaceRow({
  rowKey,
  workspace,
  label,
  count,
  active,
  expanded,
  shortcut,
  modifierLabel,
  videos,
  documentCount = 0,
  conversations,
  selectedVideoId,
  activeConversationId,
  onActivate,
  onToggle,
  onOpenLecture,
  onOpenConversation,
  onDropVideo,
  onDropWorkspace,
  onEdit,
  editor,
}: WorkspaceRowProps) {
  const [drop, setDrop] = useState<DropHint>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const treeId = useId();

  const handleDragOver = (event: DragEvent) => {
    if (onDropVideo && carries(event, VIDEO_DRAG)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDrop('into');
    } else if (onDropWorkspace && carries(event, WORKSPACE_DRAG)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = headerRef.current?.getBoundingClientRect();
      setDrop(rect && event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    const hint = drop;
    setDrop(null);
    const videoId = draggedId(event, VIDEO_DRAG);
    if (videoId != null && onDropVideo) {
      onDropVideo(videoId);
      return;
    }
    const workspaceId = draggedId(event, WORKSPACE_DRAG);
    if (workspaceId != null && onDropWorkspace) {
      onDropWorkspace(workspaceId, hint === 'before' ? 'before' : 'after');
    }
  };

  const recent = conversations.slice(0, RECENT_CHATS);

  return (
    <li
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(null);
      }}
      onDrop={handleDrop}
    >
      <div
        ref={headerRef}
        className={cn(
          'group/row relative flex min-h-10 items-center gap-0.5 rounded-md border pr-0.5',
          drop === 'into'
            ? 'border-ink bg-surface-soft'
            : active
              ? 'border-hairline bg-surface-card'
              : 'border-transparent hover:bg-surface-soft',
        )}
      >
        {(drop === 'before' || drop === 'after') && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-ink',
              drop === 'before' ? '-top-1' : '-bottom-1',
            )}
          />
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={treeId}
          aria-label={`${expanded ? 'Hide' : 'Show'} lectures and chats in ${label}`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-mute-strong hover:text-ink"
        >
          <DisclosureIcon className={cn('size-3 transition-transform', expanded && 'rotate-90')} />
        </button>

        <button
          type="button"
          onClick={onActivate}
          aria-current={active ? 'page' : undefined}
          aria-keyshortcuts={shortcut ? `Control+${shortcut} Meta+${shortcut}` : undefined}
          title={shortcut ? `${label} (${modifierLabel} ${shortcut})` : label}
          draggable={Boolean(workspace && onDropWorkspace)}
          onDragStart={(event) => {
            if (workspace) startDrag(event, WORKSPACE_DRAG, workspace.id, workspace.name);
          }}
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-sm text-left"
        >
          <WorkspaceGlyph subject={workspace ?? (rowKey as 'all' | 'unsorted')} size="sm" />
          <span className={cn('truncate text-body-xs', active ? 'font-bold text-ink' : 'text-body')}>
            {label}
          </span>
        </button>

        {/* With a mouse, the edit button takes the count's place on hover or focus. */}
        <span
          className={cn(
            'shrink-0 px-1.5 font-mono text-code-xs tabular-nums text-mute-strong',
            onEdit && !editor && 'pointer-fine:group-focus-within/row:hidden pointer-fine:group-hover/row:hidden',
          )}
        >
          {count}
          <span className="sr-only"> {count === 1 ? 'lecture' : 'lectures'}</span>
        </span>

        {onEdit && (
          <IconButton
            aria-label={`Edit ${label}`}
            aria-expanded={Boolean(editor)}
            onClick={onEdit}
            className={cn(
              'size-8',
              !editor &&
                'pointer-fine:hidden pointer-fine:group-focus-within/row:inline-flex pointer-fine:group-hover/row:inline-flex',
            )}
          >
            <EditIcon className="size-3.5" />
          </IconButton>
        )}
      </div>

      {editor}

      <div id={treeId} hidden={!expanded} className="mt-0.5 mb-1 ml-4 border-l border-hairline-soft pl-1.5">
        {videos.length === 0 ? (
          documentCount === 0 && <p className="px-2 py-1.5 text-caption-sm text-mute-strong">No lectures yet</p>
        ) : (
          <ul aria-label={`Lectures in ${label}`} className="flex flex-col">
            {videos.map((video) => {
              const title = video.title || video.filename;
              const ready = video.stage === 'ready';
              const selected = video.id === selectedVideoId;
              return (
                <li
                  key={video.id}
                  draggable
                  onDragStart={(event) => startDrag(event, VIDEO_DRAG, video.id, title)}
                >
                  <button
                    type="button"
                    onClick={() => onOpenLecture(video)}
                    disabled={!ready}
                    aria-current={selected ? 'true' : undefined}
                    title={ready ? title : `${title}: ${video.stage_label}`}
                    className={cn(
                      'flex min-h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-caption-sm',
                      selected ? 'bg-surface-soft font-bold text-ink' : 'text-body hover:bg-surface-soft',
                      !ready && 'hover:bg-transparent',
                    )}
                  >
                    <PlayIcon className="size-2.5 text-mute-strong" />
                    <span className="truncate">{title}</span>
                    {!ready && (
                      <span className="ml-auto shrink-0 text-mute-strong">
                        {video.stage === 'failed' ? 'Failed' : 'Processing'}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {documentCount > 0 && (
          <p className="flex min-h-8 items-center gap-2 px-2 text-caption-sm text-body">
            <CanvasIcon className="size-3.5 text-mute-strong" />
            {documentCount} from Canvas
          </p>
        )}

        {recent.length > 0 && (
          <ul aria-label={`Recent chats in ${label}`} className="mt-1 flex flex-col border-t border-hairline-soft pt-1">
            {recent.map((conversation) => {
              const title = conversation.title || 'Untitled chat';
              const current = conversation.id === activeConversationId;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onOpenConversation(conversation)}
                    aria-current={current ? 'true' : undefined}
                    title={title}
                    className={cn(
                      'flex min-h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-caption-sm',
                      current ? 'bg-surface-soft font-bold text-ink' : 'text-body hover:bg-surface-soft',
                    )}
                  >
                    <ChatsIcon className="size-3.5 text-mute-strong" />
                    <span className="truncate">{title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </li>
  );
}
