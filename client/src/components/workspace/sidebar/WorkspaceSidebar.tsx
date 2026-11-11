'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@/components/ui/icons';
import { useModifierLabel } from '@/hooks/useWorkspaceShortcuts';
import {
  keyOfConversation,
  nextColor,
  reordered,
  videosIn,
  type WorkspaceKey,
} from '@/lib/workspaces';
import type { CanvasStatus, ConversationItem, Deadline, VideoInfo, WorkspaceDraft, WorkspaceInfo } from '@/types/api';
import { WorkspaceEditor } from './WorkspaceEditor';
import { SidebarFooter, SidebarHeader } from './SidebarChrome';
import { SidebarRail } from './SidebarRail';
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
  /** Upcoming Canvas deadlines, every subject's, soonest first. */
  deadlines: Deadline[];
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
    deadlines,
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

  /** The props every row shares, for one part of the library. */
  const rowProps = (key: WorkspaceKey, label: string) => {
    const inKey = videosIn(videos, key);
    return {
      modifierLabel: modifier,
      selectedVideoId,
      activeConversationId,
      onOpenLecture,
      onOpenConversation,
      rowKey: key,
      label,
      count: inKey.length,
      videos: inKey,
      active: activeKey === key,
      expanded: expanded.has(key),
      conversations: chatsIn(key),
      onActivate: () => activate(key),
      onToggle: () => toggle(key),
    };
  };

  return (
    <nav aria-label="Subjects" className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <SidebarHeader
        modifier={modifier}
        onNew={() => setEditing('new')}
        onToggleCollapsed={onToggleCollapsed}
        onClose={onClose}
      />

      {error && (
        <div className="shrink-0 p-2">
          <Alert tone="danger" onClose={onClearError}>
            {error}
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-0.5">
          <WorkspaceRow {...rowProps('all', 'All lectures')} />
        </ul>

        <ul aria-label="Your subjects" className="mt-2 flex flex-col gap-0.5 border-t border-pebble pt-2">
          {workspaces.map((workspace, index) => (
            <WorkspaceRow
              {...rowProps(workspace.id, workspace.name)}
              key={workspace.id}
              workspace={workspace}
              shortcut={index < 9 ? index + 1 : undefined}
              documentCount={workspace.document_count}
              deadlines={deadlines.filter((deadline) => deadline.workspace_id === workspace.id)}
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
              <p className="text-caption text-slate-gray">
                Make one subject per course. New lectures go into whichever subject is open.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setEditing('new')}>
                <PlusIcon className="size-3.5" />
                New subject
              </Button>
            </div>
          )
        )}

        <ul className="mt-2 flex flex-col gap-0.5 border-t border-pebble pt-2">
          <WorkspaceRow
            {...rowProps('unsorted', 'Unsorted')}
            onDropVideo={(videoId) => onMoveVideo(videoId, null)}
          />
        </ul>
      </div>

      <SidebarFooter
        modifier={modifier}
        showShortcuts={Boolean(onToggleCollapsed)}
        canvasStatus={canvasStatus}
        onOpenCanvas={onOpenCanvas}
      />
    </nav>
  );
}
