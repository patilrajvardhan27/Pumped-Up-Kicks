'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
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
 * see where an answer came from and play it back from exactly there. It eases
 * in and out instead of popping, so the chat below is never shoved abruptly.
 */
export function VideoPlayer({ ref, video, citations = [], onClose }: VideoPlayerProps) {
  const player = useVideoPlayer(video?.id ?? null, ref);

  return (
    <AnimatePresence initial={false}>
      {video && (
        <m.section
          key="player"
          aria-label="Lecture player"
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          className="shrink-0 origin-top overflow-hidden rounded-md border border-hairline bg-surface-doc"
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline-soft py-1 pr-1 pl-4">
            <h2 className="min-w-0 truncate text-body-xs text-ink">{video.title || video.filename}</h2>
            {onClose && (
              <IconButton aria-label="Hide player" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            )}
          </div>

          {player.error ? (
            <p role="alert" className="px-4 py-6 text-center text-body-xs text-danger">
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
                className="max-h-[38vh] w-full bg-surface-dark"
              />

              <div className="flex items-center gap-3 p-3">
                <IconButton
                  aria-label={player.playing ? 'Pause' : 'Play'}
                  onClick={player.toggle}
                  className="border border-hairline-strong bg-surface-soft text-ink"
                >
                  {player.playing ? <PauseIcon /> : <PlayIcon />}
                </IconButton>

                <PlayerScrubber
                  currentTime={player.currentTime}
                  duration={player.duration}
                  citations={citations}
                  onSeek={player.seekTo}
                />

                <span className="shrink-0 font-mono text-code-xs tabular-nums text-body">
                  {formatClock(player.currentTime)} / {formatClock(player.duration)}
                </span>
              </div>
            </>
          )}
        </m.section>
      )}
    </AnimatePresence>
  );
}
