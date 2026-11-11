'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { SidebarIcon } from '@/components/ui/icons';
import { useModifierLabel } from '@/hooks/useWorkspaceShortcuts';
import { cn } from '@/lib/cn';
import { CanvasEntry } from '../canvas/CanvasEntry';
import { VIDEO_DRAG, carries, draggedId } from './dnd';
import { WorkspaceGlyph } from './WorkspaceGlyph';
import type { WorkspaceSidebarProps } from './WorkspaceSidebar';

/** The collapsed sidebar: one tile per subject, still a drop target for lectures. */
export function SidebarRail({
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
      className="panel flex h-full min-h-0 flex-col items-center gap-1 overflow-y-auto py-3"
    >
      <IconButton
        aria-label="Show the subject list"
        aria-keyshortcuts="Control+\ Meta+\"
        title={`Show subjects (${modifier} \\)`}
        onClick={onToggleCollapsed}
      >
        <SidebarIcon />
      </IconButton>
      <span aria-hidden="true" className="my-1 h-px w-6 bg-pebble" />
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
      <span aria-hidden="true" className="mt-auto mb-1 h-px w-6 bg-pebble" />
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
          'flex size-10 items-center justify-center rounded-lg border',
          dropping
            ? 'border-signal-blue bg-blue-wash'
            : active
              ? 'border-transparent bg-blue-wash'
              : 'border-transparent hover:bg-pebble',
        )}
      >
        {glyph}
      </button>
    </li>
  );
}
