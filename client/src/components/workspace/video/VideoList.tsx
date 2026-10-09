'use client';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LibraryIcon } from '@/components/ui/icons';
import type { VideoInfo, WorkspaceInfo } from '@/types/api';
import { VideoListItem } from './VideoListItem';

interface VideoListProps {
  /** The lectures in the open subject. */
  videos: VideoInfo[];
  /** Shown as the card's heading: the open subject's name. */
  heading: string;
  /** Every subject, for each lecture's "Subject" menu. */
  workspaces: WorkspaceInfo[];
  loading: boolean;
  error: string | null;
  onClearError: () => void;
  deletingId: number | null;
  onDelete: (id: number) => void;
  onMove: (id: number, workspaceId: number | null) => void;
  /** Lecture the chat is scoped to; null means the whole subject. */
  selectedId?: number | null;
  onSelect?: (id: number | null) => void;
}

export function VideoList({
  videos,
  heading,
  workspaces,
  loading,
  error,
  onClearError,
  deletingId,
  onDelete,
  onMove,
  selectedId = null,
  onSelect,
}: VideoListProps) {
  const readyCount = videos.filter((video) => video.stage === 'ready').length;

  const confirmDelete = (video: VideoInfo) => {
    const confirmed = window.confirm(
      `Delete “${video.title}”? Its transcript and search index go with it.`,
    );
    if (confirmed) onDelete(video.id);
  };

  return (
    <Card as="section" padding="tile" aria-labelledby="library-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="library-heading" className="flex min-w-0 items-center gap-2 text-heading-sm text-ink">
          <LibraryIcon className="size-5" />
          <span className="truncate">{heading}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {selectedId !== null && (
            <Button variant="tertiary" size="sm" onClick={() => onSelect?.(null)}>
              Search all
            </Button>
          )}
          <span className="font-mono text-code-xs tabular-nums text-mute-strong">
            {readyCount}/{videos.length} ready
          </span>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="Library" onClose={onClearError}>
          {error}
        </Alert>
      )}

      {loading ? (
        <p className="py-6 text-center text-body-xs text-mute-strong">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="py-6 text-center text-body-xs text-body">
          No lectures here yet. Add one above, or drag one in from another subject.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((video) => (
            <VideoListItem
              key={video.id}
              video={video}
              workspaces={workspaces}
              selected={selectedId === video.id}
              deleting={deletingId === video.id}
              onSelect={(id) => onSelect?.(id)}
              onDelete={confirmDelete}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
