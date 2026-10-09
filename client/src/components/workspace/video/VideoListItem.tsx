import { useId } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { SpinnerIcon, TrashIcon } from '@/components/ui/icons';
import { VIDEO_DRAG, startDrag } from '@/components/workspace/sidebar/dnd';
import { cn } from '@/lib/cn';
import { formatBytes, formatClock } from '@/lib/format';
import type { VideoInfo, WorkspaceInfo } from '@/types/api';
import { PipelineTrack } from './PipelineTrack';

interface VideoListItemProps {
  video: VideoInfo;
  workspaces: WorkspaceInfo[];
  selected: boolean;
  deleting: boolean;
  onSelect: (id: number) => void;
  onDelete: (video: VideoInfo) => void;
  onMove: (id: number, workspaceId: number | null) => void;
}

const MISSING = '-';
const UNSORTED = 'unsorted';

export function VideoListItem({
  video,
  workspaces,
  selected,
  deleting,
  onSelect,
  onDelete,
  onMove,
}: VideoListItemProps) {
  const ready = video.stage === 'ready';
  const title = video.title || video.filename;
  const moveId = useId();

  return (
    <li
      draggable
      onDragStart={(event) => startDrag(event, VIDEO_DRAG, video.id, title)}
      className={cn(
        'relative flex flex-col gap-3 rounded-md border p-4',
        selected
          ? 'border-ink bg-surface-soft'
          : video.stage === 'failed'
            ? 'border-danger bg-surface-doc'
            : 'border-hairline bg-surface-doc',
        ready && !selected && 'hover:border-hairline-strong',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {ready ? (
            // The stretched ::after makes the whole row the click target while
            // keeping the delete button a sibling, not a nested control.
            <button
              type="button"
              onClick={() => onSelect(video.id)}
              aria-pressed={selected}
              className="block max-w-full truncate rounded-sm text-left text-body-sm-strong text-ink after:absolute after:inset-0 after:rounded-md"
            >
              {title}
            </button>
          ) : (
            <p className="truncate text-body-sm-strong text-ink">{title}</p>
          )}
          <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-code-xs tabular-nums text-mute-strong">
            <span>{video.duration ? formatClock(video.duration) : MISSING}</span>
            <span>{video.file_size ? formatBytes(video.file_size) : MISSING}</span>
            {video.num_segments ? <span>{video.num_segments} segments</span> : null}
            <span>{new Date(video.uploaded_at).toLocaleDateString()}</span>
          </p>
        </div>

        <IconButton
          tone="danger"
          aria-label={`Delete ${title}`}
          disabled={deleting}
          onClick={() => onDelete(video)}
          className="relative -mt-1.5 -mr-1.5"
        >
          {deleting ? <SpinnerIcon /> : <TrashIcon />}
        </IconButton>
      </div>

      <PipelineTrack video={video} />

      {/* Moving by menu works by keyboard and on touch, where dragging does not. */}
      <div className="relative flex items-center gap-2">
        <label htmlFor={moveId} className="shrink-0 text-caption-sm text-mute-strong">
          Subject
        </label>
        <select
          id={moveId}
          value={video.workspace_id ?? UNSORTED}
          onChange={(event) =>
            onMove(video.id, event.target.value === UNSORTED ? null : Number(event.target.value))
          }
          className="h-8 min-w-0 flex-1 truncate rounded-sm border border-hairline-strong bg-surface-card px-2 text-caption-sm text-ink"
        >
          <option value={UNSORTED}>Unsorted</option>
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </div>

      {video.stage === 'failed' && video.error_message && (
        <p className="rounded-sm bg-accent-red-soft p-2.5 font-mono text-code-xs break-words text-ink">
          {video.error_message}
        </p>
      )}
    </li>
  );
}
