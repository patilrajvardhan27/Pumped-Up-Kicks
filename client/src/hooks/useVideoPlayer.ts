'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { videoService } from '@/services/videoService';

export interface VideoPlayerHandle {
  /** Jump to a point in a lecture. The player loads it first if it isn't the current one. */
  seek: (videoId: number, seconds: number) => void;
}

interface Source {
  id: number;
  url: string;
}

interface PlayerError {
  id: number;
  message: string;
}

/** Playback state for one lecture: its signed source, position and controls. */
export function useVideoPlayer(videoId: number | null, ref?: Ref<VideoPlayerHandle>) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [failure, setFailure] = useState<PlayerError | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  // A seek requested before the source finished loading.
  const pendingSeek = useRef<number | null>(null);

  // Switching or closing the lecture drops its signed URL, so reopening one
  // always fetches a fresh link instead of replaying a possibly expired one.
  const [trackedId, setTrackedId] = useState(videoId);
  if (trackedId !== videoId) {
    setTrackedId(videoId);
    setSource(null);
    setFailure(null);
  }

  useEffect(() => {
    if (videoId == null) return;

    let cancelled = false;
    videoService
      .getPlaybackUrl(videoId)
      .then((playback) => {
        if (cancelled) return;
        setSource({ id: videoId, url: playback.url });
        setFailure(null);
        if (playback.duration) setDuration(playback.duration);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFailure({
          id: videoId,
          message: err instanceof Error ? err.message : 'Could not load this lecture.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const loaded = source?.id === videoId;

  useImperativeHandle(
    ref,
    () => ({
      seek: (targetId: number, seconds: number) => {
        const media = mediaRef.current;
        // readyState 1 (HAVE_METADATA) is the point at which seeking is meaningful.
        if (targetId === videoId && loaded && media && media.readyState >= 1) {
          media.currentTime = seconds;
          media.play().catch(() => undefined);
        } else {
          pendingSeek.current = seconds;
        }
      },
    }),
    [videoId, loaded],
  );

  const handleLoadedMetadata = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (Number.isFinite(media.duration)) setDuration(media.duration);
    if (pendingSeek.current != null) {
      media.currentTime = pendingSeek.current;
      pendingSeek.current = null;
      media.play().catch(() => undefined);
    }
  }, []);

  const toggle = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) media.play().catch(() => undefined);
    else media.pause();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(media.duration)) return;
    media.currentTime = Math.min(media.duration, Math.max(0, seconds));
  }, []);

  return {
    src: loaded ? source.url : undefined,
    error: failure?.id === videoId ? failure.message : null,
    currentTime,
    duration,
    playing,
    toggle,
    seekTo,
    mediaProps: {
      ref: mediaRef,
      onLoadStart: () => {
        setCurrentTime(0);
        setPlaying(false);
      },
      onLoadedMetadata: handleLoadedMetadata,
      onTimeUpdate: (event: React.SyntheticEvent<HTMLVideoElement>) =>
        setCurrentTime(event.currentTarget.currentTime),
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onError: () => {
        if (videoId != null) setFailure({ id: videoId, message: 'This lecture could not be played.' });
      },
    },
  };
}
