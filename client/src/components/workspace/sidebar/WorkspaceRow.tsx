'use client';

import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { DisclosureIcon, EditIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { WorkspaceKey } from '@/lib/workspaces';
import type { ConversationItem, Deadline, VideoInfo, WorkspaceInfo } from '@/types/api';
import { VIDEO_DRAG, WORKSPACE_DRAG, carries, draggedId, startDrag } from './dnd';
import { RowTree, useUrgentDeadline } from './RowTree';
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
  /** Upcoming Canvas deadlines in this subject, soonest first. */
  deadlines?: Deadline[];
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
  deadlines = [],
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

  const urgent = useUrgentDeadline(deadlines);

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
          'group/row relative flex min-h-10 items-center gap-0.5 rounded-lg border pr-0.5',
          drop === 'into'
            ? 'border-signal-blue bg-blue-wash'
            : active
              ? 'border-transparent bg-blue-wash'
              : 'border-transparent hover:bg-pebble',
        )}
      >
        {(drop === 'before' || drop === 'after') && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-signal-blue',
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
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-gray hover:text-ink-navy"
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
          className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md text-left"
        >
          <WorkspaceGlyph subject={workspace ?? (rowKey as 'all' | 'unsorted')} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate', active ? 'text-label text-ink-navy' : 'text-body-sm text-slate-gray')}>
              {label}
            </span>
            {urgent && (
              <span className="truncate text-caption text-danger">
                {urgent.label}: {urgent.deadline.title}
              </span>
            )}
          </span>
        </button>

        {/* With a mouse, the edit button takes the count's place on hover or focus. */}
        <span
          className={cn(
            'shrink-0 px-1.5 tabular-nums text-caption text-slate-gray',
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

      <RowTree
        id={treeId}
        label={label}
        expanded={expanded}
        videos={videos}
        documentCount={documentCount}
        deadlines={deadlines}
        conversations={conversations}
        selectedVideoId={selectedVideoId}
        activeConversationId={activeConversationId}
        onOpenLecture={onOpenLecture}
        onOpenConversation={onOpenConversation}
      />
    </li>
  );
}
