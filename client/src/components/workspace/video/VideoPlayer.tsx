'use client';

import type { Ref } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { CloseIcon, PauseIcon, PlayIcon } from '@/components/ui/icons';
import { useVideoPlayer } from '@/hooks/useVideoPlayer';
import type { VideoPlayerHandle } from '@/hooks/useVideoPlayer';
import { formatClock } from '@/lib/format';
import type { VideoInfo } from '@/types/api';
import { PlayerScrubber } from './PlayerScrubber';

interface VideoPlayerProps {
  ref?: Ref<VideoPlayerHandle>;
  video: VideoInfo | null;
  /** Marks drawn on the scrubber: the passages an answer cited. */
  citations?: { start: number; end: number }[];
  onClose?: () => void;
}

/**
 * The lecture itself. Cited passages are marked on its scrubber, so you can
 * see where an answer came from and play it back from exactly there. It rises
 * in rather than popping, so the chat below is not shoved abruptly.
 */
export function VideoPlayer({ ref, video, citations = [], onClose }: VideoPlayerProps) {
  const player = useVideoPlayer(video?.id ?? null, ref);

  if (!video) return null;

  return (
        <section
          aria-label="Lecture player"
          className="shrink-0 animate-rise overflow-hidden rounded-2xl border border-hairline bg-paper shadow-link"
        >
          <div className="flex items-center justify-between gap-3 border-b border-pebble py-1 pr-1 pl-4">
            <h2 className="min-w-0 truncate text-body-sm text-ink-navy">{video.title || video.filename}</h2>
            {onClose && (
              <IconButton aria-label="Hide player" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            )}
          </div>

          {player.error ? (
            <p role="alert" className="px-4 py-6 text-center text-body-sm text-danger">
              {player.error}
            </p>
          ) : (
            <>
              <video
                {...player.mediaProps}
                src={player.src}
                controls={false}
                preload="metadata"
                playsInline
                className="max-h-video w-full bg-ink-navy"
              />

              <div className="flex items-center gap-3 p-3">
                <IconButton
                  aria-label={player.playing ? 'Pause' : 'Play'}
                  onClick={player.toggle}
                  className="border border-hairline bg-pebble text-ink-navy"
                >
                  {player.playing ? <PauseIcon /> : <PlayIcon />}
                </IconButton>

                <PlayerScrubber
                  currentTime={player.currentTime}
                  duration={player.duration}
                  citations={citations}
                  onSeek={player.seekTo}
                />

                <span className="shrink-0 tabular-nums text-caption text-slate-gray">
                  {formatClock(player.currentTime)} / {formatClock(player.duration)}
                </span>
              </div>
            </>
          )}
        </section>
  );
}
