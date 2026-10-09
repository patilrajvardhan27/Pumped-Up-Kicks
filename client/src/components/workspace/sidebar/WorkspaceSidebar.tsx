'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { CloseIcon, PlusIcon, SidebarIcon } from '@/components/ui/icons';
import { useModifierLabel } from '@/hooks/useWorkspaceShortcuts';
import { cn } from '@/lib/cn';
import {
  keyOfConversation,
  nextColor,
  reordered,
  videosIn,
  type WorkspaceKey,
} from '@/lib/workspaces';
import type { CanvasStatus, ConversationItem, VideoInfo, WorkspaceDraft, WorkspaceInfo } from '@/types/api';
import { CanvasEntry } from '../canvas/CanvasEntry';
import { VIDEO_DRAG, carries, draggedId } from './dnd';
import { WorkspaceEditor } from './WorkspaceEditor';
import { WorkspaceGlyph } from './WorkspaceGlyph';
import { WorkspaceRow } from './WorkspaceRow';

export interface WorkspaceSidebarProps {
  workspaces: WorkspaceInfo[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  /** Every lecture; the sidebar groups them by subject. */
  videos: VideoInfo[];
  /** Every chat, most recent first. */
  conversations: ConversationItem[];
  activeKey: WorkspaceKey;
  selectedVideoId: number | null;
  activeConversationId: number | null;
  /** Desktop only: shrink to a rail of subject tiles. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Drawer only: close the drawer. */
  onClose?: () => void;
  onSelect: (key: WorkspaceKey) => void;
  onOpenLecture: (video: VideoInfo) => void;
  onOpenConversation: (conversation: ConversationItem) => void;
  onMoveVideo: (videoId: number, workspaceId: number | null) => void;
  onCreate: (draft: WorkspaceDraft) => Promise<WorkspaceInfo | null>;
  onUpdate: (id: number, change: Partial<WorkspaceDraft>) => Promise<boolean>;
  onDelete: (workspace: WorkspaceInfo) => void;
  onReorder: (ids: number[]) => void;
  canvasStatus: CanvasStatus | null;
  onOpenCanvas: () => void;
}

/**
 * The subject list, modelled on Arc's Spaces: one row per subject, each opening
 * onto its lectures and recent chats, with Unsorted at the bottom for anything
 * not yet filed. Lectures can be dragged onto any subject to move them.
 */
export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const {
    workspaces,
    loading,
    error,
    onClearError,
    videos,
    conversations,
    activeKey,
    selectedVideoId,
    activeConversationId,
    collapsed = false,
    onToggleCollapsed,
    onClose,
    onSelect,
    onOpenLecture,
    onOpenConversation,
    onMoveVideo,
    onCreate,
    onUpdate,
    onDelete,
    onReorder,
    canvasStatus,
    onOpenCanvas,
  } = props;

  const modifier = useModifierLabel();
  const [expanded, setExpanded] = useState<Set<WorkspaceKey>>(() => new Set([activeKey]));
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  if (collapsed) return <SidebarRail {...props} />;

  const ids = workspaces.map((workspace) => workspace.id);
  const chatsIn = (key: WorkspaceKey) =>
    conversations.filter((conversation) => keyOfConversation(conversation) === key);

  const toggle = (key: WorkspaceKey) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const activate = (key: WorkspaceKey) => {
    setExpanded((prev) => new Set(prev).add(key));
    onSelect(key);
  };

  const dropSubject = (index: number) => (dragged: number, place: 'before' | 'after') => {
    const target = workspaces[index].id;
    const beforeId = place === 'before' ? target : (workspaces[index + 1]?.id ?? null);
    if (dragged === target || beforeId === dragged) return;
    onReorder(reordered(ids, dragged, beforeId));
  };

  const swap = (index: number, other: number) => {
    const next = [...ids];
    [next[index], next[other]] = [next[other], next[index]];
    onReorder(next);
  };

  const shared = {
    modifierLabel: modifier,
    selectedVideoId,
    activeConversationId,
    onOpenLecture,
    onOpenConversation,
  };

  return (
    <nav aria-label="Subjects" className="flex h-full min-h-0 flex-col rounded-lg border border-hairline bg-canvas">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-hairline-soft pr-1 pl-3">
        <h2 className="text-caption-md text-ink">Subjects</h2>
        <div className="flex items-center">
          <IconButton aria-label="New subject" onClick={() => setEditing('new')}>
            <PlusIcon />
          </IconButton>
          {onToggleCollapsed && (
            <IconButton
              aria-label="Hide the subject list"
              aria-keyshortcuts="Control+\ Meta+\"
              title={`Hide (${modifier} \\)`}
              onClick={onToggleCollapsed}
            >
              <SidebarIcon />
            </IconButton>
          )}
          {onClose && (
            <IconButton aria-label="Close the subject list" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 p-2">
          <Alert tone="danger" onClose={onClearError}>
            {error}
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          <WorkspaceRow
            {...shared}
            rowKey="all"
            label="All lectures"
            count={videos.length}
            active={activeKey === 'all'}
            expanded={expanded.has('all')}
            videos={videos}
            conversations={chatsIn('all')}
            onActivate={() => activate('all')}
            onToggle={() => toggle('all')}
          />
        </ul>

        <ul aria-label="Your subjects" className="mt-2 flex flex-col gap-0.5 border-t border-hairline-soft pt-2">
          {workspaces.map((workspace, index) => (
            <WorkspaceRow
              {...shared}
              key={workspace.id}
              rowKey={workspace.id}
              workspace={workspace}
              label={workspace.name}
              count={videosIn(videos, workspace.id).length}
              active={activeKey === workspace.id}
              expanded={expanded.has(workspace.id)}
              shortcut={index < 9 ? index + 1 : undefined}
              videos={videosIn(videos, workspace.id)}
              documentCount={workspace.document_count}
              conversations={chatsIn(workspace.id)}
              onActivate={() => activate(workspace.id)}
              onToggle={() => toggle(workspace.id)}
              onDropVideo={(videoId) => onMoveVideo(videoId, workspace.id)}
              onDropWorkspace={dropSubject(index)}
              onEdit={() => setEditing(editing === workspace.id ? null : workspace.id)}
              editor={
                editing === workspace.id && (
                  <WorkspaceEditor
                    mode="edit"
                    initial={{ name: workspace.name, color: workspace.color, icon: workspace.icon }}
                    onSave={(draft) => onUpdate(workspace.id, draft)}
                    onCancel={() => setEditing(null)}
                    onDelete={() => {
                      setEditing(null);
                      onDelete(workspace);
                    }}
                    onMoveUp={index > 0 ? () => swap(index, index - 1) : undefined}
                    onMoveDown={index < workspaces.length - 1 ? () => swap(index, index + 1) : undefined}
                  />
                )
              }
            />
          ))}
        </ul>

        {editing === 'new' ? (
          <WorkspaceEditor
            mode="create"
            initial={{ name: '', color: nextColor(workspaces), icon: 'book' }}
            onSave={async (draft) => {
              const created = await onCreate(draft);
              if (created) activate(created.id);
              return Boolean(created);
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          !loading &&
          workspaces.length === 0 && (
            <div className="flex flex-col items-start gap-3 px-2 py-3">
              <p className="text-caption-sm text-body">
                Make one subject per course. New lectures go into whichever subject is open.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
                <PlusIcon className="size-3.5" />
                New subject
              </Button>
            </div>
          )
        )}

        <ul className="mt-2 flex flex-col gap-0.5 border-t border-hairline-soft pt-2">
          <WorkspaceRow
            {...shared}
            rowKey="unsorted"
            label="Unsorted"
            count={videosIn(videos, 'unsorted').length}
            active={activeKey === 'unsorted'}
            expanded={expanded.has('unsorted')}
            videos={videosIn(videos, 'unsorted')}
            conversations={chatsIn('unsorted')}
            onActivate={() => activate('unsorted')}
            onToggle={() => toggle('unsorted')}
            onDropVideo={(videoId) => onMoveVideo(videoId, null)}
          />
        </ul>
      </div>

      <div className="shrink-0 border-t border-hairline-soft p-2">
        <CanvasEntry status={canvasStatus} onOpen={onOpenCanvas} />
      </div>

      {onToggleCollapsed && (
        <p className="shrink-0 border-t border-hairline-soft px-3 py-2 text-caption-sm text-mute-strong">
          <Kbd>{modifier}</Kbd> <Kbd>1</Kbd> to <Kbd>9</Kbd> opens a subject. <Kbd>{modifier}</Kbd>{' '}
          <Kbd>\</Kbd> hides this list.
        </p>
      )}
    </nav>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-xs bg-surface-soft px-1 font-mono text-code-xs text-ink">{children}</kbd>;
}

/** The collapsed sidebar: one tile per subject, still a drop target for lectures. */
function SidebarRail({
  workspaces,
  videos,
  activeKey,
  onToggleCollapsed,
  onSelect,
  onMoveVideo,
  canvasStatus,
  onOpenCanvas,
}: WorkspaceSidebarProps) {
  const modifier = useModifierLabel();

  return (
    <nav
      aria-label="Subjects"
      className="flex h-full min-h-0 flex-col items-center gap-1 overflow-y-auto rounded-lg border border-hairline bg-canvas py-2"
    >
      <IconButton
        aria-label="Show the subject list"
        aria-keyshortcuts="Control+\ Meta+\"
        title={`Show subjects (${modifier} \\)`}
        onClick={onToggleCollapsed}
      >
        <SidebarIcon />
      </IconButton>
      <span aria-hidden="true" className="my-1 h-px w-6 bg-hairline-soft" />
      <ul className="flex flex-col items-center gap-1">
        <RailTile
          label={`All lectures, ${videos.length}`}
          active={activeKey === 'all'}
          onClick={() => onSelect('all')}
          glyph={<WorkspaceGlyph subject="all" />}
        />
        {workspaces.map((workspace, index) => (
          <RailTile
            key={workspace.id}
            label={workspace.name}
            shortcut={index < 9 ? `${modifier} ${index + 1}` : undefined}
            active={activeKey === workspace.id}
            onClick={() => onSelect(workspace.id)}
            onDropVideo={(id) => onMoveVideo(id, workspace.id)}
            glyph={<WorkspaceGlyph subject={workspace} />}
          />
        ))}
        <RailTile
          label="Unsorted"
          active={activeKey === 'unsorted'}
          onClick={() => onSelect('unsorted')}
          onDropVideo={(id) => onMoveVideo(id, null)}
          glyph={<WorkspaceGlyph subject="unsorted" />}
        />
      </ul>
      <span aria-hidden="true" className="mt-auto mb-1 h-px w-6 bg-hairline-soft" />
      <CanvasEntry status={canvasStatus} onOpen={onOpenCanvas} compact />
    </nav>
  );
}

function RailTile({
  label,
  shortcut,
  active,
  glyph,
  onClick,
  onDropVideo,
}: {
  label: string;
  shortcut?: string;
  active: boolean;
  glyph: ReactNode;
  onClick: () => void;
  onDropVideo?: (videoId: number) => void;
}) {
  const [dropping, setDropping] = useState(false);

  const over = (event: DragEvent) => {
    if (!onDropVideo || !carries(event, VIDEO_DRAG)) return;
    event.preventDefault();
    setDropping(true);
  };

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        title={shortcut ? `${label} (${shortcut})` : label}
        onDragOver={over}
        onDragLeave={() => setDropping(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropping(false);
          const id = draggedId(event, VIDEO_DRAG);
          if (id != null) onDropVideo?.(id);
        }}
        className={cn(
          'flex size-10 items-center justify-center rounded-md border',
          dropping
            ? 'border-ink bg-surface-soft'
            : active
              ? 'border-hairline bg-surface-card'
              : 'border-transparent hover:bg-surface-soft',
        )}
      >
        {glyph}
      </button>
    </li>
  );
}
