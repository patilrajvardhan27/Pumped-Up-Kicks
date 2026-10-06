'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { videoService } from '@/services';
import type { VideoInfo, VideoStage } from '@/types/api';
import Alert from './Alert';

/**
 * The pipeline every upload runs through. This is a real sequence, so it is
 * numbered and shown in order — a student can see exactly which step they are
 * waiting on.
 */
const PIPELINE: { stage: VideoStage; label: string }[] = [
  { stage: 'queued', label: 'Queued' },
  { stage: 'transcribing', label: 'Transcribing' },
  { stage: 'indexing', label: 'Indexing' },
  { stage: 'ready', label: 'Ready' },
];

const POLL_MS = 3000;

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

function PipelineTrack({ video }: { video: VideoInfo }) {
  if (video.stage === 'failed') {
    return (
      <p className="font-mono text-xs text-fault">Processing failed</p>
    );
  }

  const isReady = video.stage === 'ready';
  const currentIndex = isReady
    ? PIPELINE.length
    : PIPELINE.findIndex((step) => step.stage === video.stage);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {PIPELINE.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;

          return (
            <div key={step.stage} className="flex flex-1 flex-col gap-1.5">
              <div className="h-1 overflow-hidden rounded-full bg-well">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    done
                      ? 'w-full bg-live/60'
                      : active
                        ? 'tape-moving w-full bg-signal'
                        : 'w-0 bg-transparent'
                  }`}
                />
              </div>
              <span
                className={`font-mono text-[0.6rem] uppercase tracking-wider transition-colors ${
                  active ? 'text-signal' : done ? 'text-live/70' : 'text-faint/60'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VideoListProps {
  refreshTrigger?: number;
  /** Lecture the chat is scoped to; null means all of them. */
  selectedId?: number | null;
  onVideosChange?: (videos: VideoInfo[]) => void;
  onSelect?: (id: number | null) => void;
}

export default function VideoList({
  refreshTrigger,
  selectedId = null,
  onVideosChange,
  onSelect,
}: VideoListProps) {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const notify = useRef(onVideosChange);
  notify.current = onVideosChange;

  const loadVideos = useCallback(async () => {
    try {
      const result = await videoService.listVideos();
      setVideos(result.videos);
      notify.current?.(result.videos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos, refreshTrigger]);

  // Poll only while something is still being processed, then stop.
  const inFlight = videos.some((v) => v.stage !== 'ready' && v.stage !== 'failed');

  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(loadVideos, POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, loadVideos]);

  const handleDelete = async (video: VideoInfo) => {
    const confirmed = window.confirm(
      `Delete "${video.title}"? Its transcript and search index go with it.`,
    );
    if (!confirmed) return;

    setDeletingId(video.id);
    try {
      await videoService.deleteVideo(video.id);
      await loadVideos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that video.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-lg text-ink">Library</h3>
        <div className="flex items-baseline gap-3">
          {selectedId !== null && (
            <button
              onClick={() => onSelect?.(null)}
              className="font-mono text-[0.65rem] uppercase tracking-wider text-signal
                         transition-opacity hover:opacity-70"
            >
              Search all
            </button>
          )}
          <span className="font-mono text-[0.65rem] text-faint">
            {videos.filter((v) => v.stage === 'ready').length}/{videos.length} ready
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="fault" title="Library" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center font-mono text-sm text-faint">Loading…</p>
      ) : videos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No lectures yet. Add one above and it will appear here as it processes.
        </p>
      ) : (
        <ul className="space-y-3">
          {videos.map((video) => (
            <li
              key={video.id}
              role={video.stage === 'ready' ? 'button' : undefined}
              tabIndex={video.stage === 'ready' ? 0 : undefined}
              onClick={() => video.stage === 'ready' && onSelect?.(video.id)}
              onKeyDown={(e) => {
                if (video.stage === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelect?.(video.id);
                }
              }}
              className={`rounded-lg border bg-well p-4 transition-colors ${
                video.stage === 'ready' ? 'cursor-pointer' : ''
              } ${
                selectedId === video.id
                  ? 'border-signal/60 bg-signal/[0.06]'
                  : video.stage === 'failed'
                    ? 'border-fault/40'
                    : 'border-line hover:border-line-bright'
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4
                    className={`truncate font-medium ${
                      selectedId === video.id ? 'text-signal' : 'text-ink'
                    }`}
                  >
                    {video.title}
                  </h4>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[0.65rem] text-faint">
                    <span>{formatDuration(video.duration)}</span>
                    <span>{formatBytes(video.file_size)}</span>
                    {video.num_segments ? <span>{video.num_segments} segments</span> : null}
                    <span>{new Date(video.uploaded_at).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {video.stage === 'ready' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-live" title="Ready to query" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(video);
                    }}
                    disabled={deletingId === video.id}
                    aria-label={`Delete ${video.title}`}
                    className="rounded p-1.5 text-faint transition-colors hover:bg-fault/10
                               hover:text-fault disabled:opacity-40"
                  >
                    {deletingId === video.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <PipelineTrack video={video} />

              {video.stage === 'failed' && video.error_message && (
                <p className="mt-3 rounded border border-fault/30 bg-fault/[0.06] p-2.5 font-mono text-[0.65rem] leading-relaxed text-fault">
                  {video.error_message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
