'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/services/api';
import { videoService } from '@/services/videoService';
import type { VideoInfo } from '@/types/api';

const POLL_MS = 3000;

/** The API's own message when it answered; the fallback when it never did. */
const messageOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/**
 * The lecture library, every subject at once. Polls only while something is
 * still being processed, then stops.
 */
export function useVideoLibrary(refreshTrigger?: number) {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    videoService
      .listVideos()
      .then((result) => {
        if (cancelled) return;
        setVideos(result.videos);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Could not reach the server. Check that the API is running, then reload.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, reloadCount]);

  const inFlight = videos.some((video) => video.stage !== 'ready' && video.stage !== 'failed');

  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => setReloadCount((count) => count + 1), POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight]);

  const deleteVideo = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      await videoService.deleteVideo(id);
      setReloadCount((count) => count + 1);
    } catch (err) {
      setError(messageOf(err, 'Could not delete that video. Try again.'));
    } finally {
      setDeletingId(null);
    }
  }, []);

  /** Files a lecture under another subject. Shown at once; undone if the server refuses. */
  const moveVideo = useCallback(
    async (id: number, workspaceId: number | null) => {
      const previous = videos.find((video) => video.id === id)?.workspace_id ?? null;
      const place = (target: number | null) =>
        setVideos((prev) =>
          prev.map((video) => (video.id === id ? { ...video, workspace_id: target } : video)),
        );

      place(workspaceId);
      try {
        await videoService.moveVideo(id, workspaceId);
      } catch (err) {
        place(previous);
        setError(messageOf(err, 'Could not move that lecture. Try again.'));
      }
    },
    [videos],
  );

  const clearError = useCallback(() => setError(null), []);

  return { videos, loading, error, clearError, deletingId, deleteVideo, moveVideo };
}
