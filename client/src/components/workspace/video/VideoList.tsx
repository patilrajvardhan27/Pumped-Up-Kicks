'use client';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LibraryIcon } from '@/components/ui/icons';
import { useVideoLibrary } from '@/hooks/useVideoLibrary';
import type { VideoInfo } from '@/types/api';
import { VideoListItem } from './VideoListItem';

interface VideoListProps {
  refreshTrigger?: number;
  /** Lecture the chat is scoped to; null means all of them. */
  selectedId?: number | null;
  onVideosChange?: (videos: VideoInfo[]) => void;
  onSelect?: (id: number | null) => void;
}

export function VideoList({ refreshTrigger, selectedId = null, onVideosChange, onSelect }: VideoListProps) {
  const library = useVideoLibrary(refreshTrigger, onVideosChange);
  const { videos } = library;
  const readyCount = videos.filter((video) => video.stage === 'ready').length;

  const confirmDelete = (video: VideoInfo) => {
    const confirmed = window.confirm(
      `Delete \u201c${video.title}\u201d? Its transcript and search index go with it.`,
    );
    if (confirmed) library.deleteVideo(video.id);
  };

  return (
    <Card as="section" padding="tile" aria-labelledby="library-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="library-heading" className="flex items-center gap-2 text-heading-sm text-ink">
          <LibraryIcon className="size-5" />
          Library
        </h2>
        <div className="flex items-center gap-2">
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

      {library.error && (
        <Alert tone="danger" title="Library" onClose={library.clearError}>
          {library.error}
        </Alert>
      )}

      {library.loading ? (
        <p className="py-6 text-center text-body-xs text-mute-strong">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="py-6 text-center text-body-xs text-body">
          No lectures yet. Add one above and it will appear here as it processes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((video) => (
            <VideoListItem
              key={video.id}
              video={video}
              selected={selectedId === video.id}
              deleting={library.deletingId === video.id}
              onSelect={(id) => onSelect?.(id)}
              onDelete={confirmDelete}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
