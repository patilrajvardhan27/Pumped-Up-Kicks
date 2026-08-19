'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { videoService } from '@/services';
import type { VideoInfo } from '@/types/api';

export interface VideoPlayerHandle {
  /** Jump to a point in a lecture, loading it first if it isn't the current one. */
  seek: (videoId: number, seconds: number) => void;
}

interface VideoPlayerProps {
  video: VideoInfo | null;
  /** Marks drawn on the scrubber — the passages an answer cited. */
  citations?: { start: number; end: number }[];
  onClose?: () => void;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * The lecture itself, with a scrubber that doubles as the tape strip: cited
 * passages are marked on it, so you can see where the answer came from and play
 * it back from exactly there.
 */
const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(function VideoPlayer(
  { video, citations = [], onClose },
  ref,
) {
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  // A seek requested before the source finished loading.
  const pendingSeek = useRef<number | null>(null);

  const loadSource = useCallback(async (videoId: number) => {
    setError(null);
    try {
      const playback = await videoService.getPlaybackUrl(videoId);
      setSrc(playback.url);
      setLoadedId(videoId);
      if (playback.duration) setDuration(playback.duration);
    } catch (err) {
      setSrc(null);
      setError(err instanceof Error ? err.message : 'Could not load this lecture.');
    }
  }, []);

  useEffect(() => {
    if (!video) {
      setSrc(null);
      setLoadedId(null);
      return;
    }
    if (video.id !== loadedId) loadSource(video.id);
  }, [video, loadedId, loadSource]);

  const applySeek = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;

    // readyState 1 (HAVE_METADATA) is the point at which seeking is meaningful.
    if (media.readyState >= 1) {
      media.currentTime = seconds;
      media.play().catch(() => undefined);
    } else {
      pendingSeek.current = seconds;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      seek: (videoId: number, seconds: number) => {
        if (videoId !== loadedId) {
          pendingSeek.current = seconds;
          loadSource(videoId);
          return;
        }
        applySeek(seconds);
      },
    }),
    [loadedId, loadSource, applySeek],
  );

  const handleLoadedMetadata = () => {
    const media = mediaRef.current;
    if (!media) return;
    if (Number.isFinite(media.duration)) setDuration(media.duration);
    if (pendingSeek.current != null) {
      media.currentTime = pendingSeek.current;
      pendingSeek.current = null;
      media.play().catch(() => undefined);
    }
  };

  const scrub = (event: React.MouseEvent<HTMLDivElement>) => {
    const media = mediaRef.current;
    if (!media || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    media.currentTime = Math.min(duration, Math.max(0, ratio * duration));
  };

  if (!video) return null;

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <section className="mb-5 shrink-0 rounded-panel border border-line bg-well">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
          <h3 className="truncate text-sm text-ink">{video.title || video.filename}</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Hide player"
            className="shrink-0 rounded p-1 text-faint transition-colors hover:text-ink"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error ? (
        <p className="px-4 py-6 text-center text-sm text-fault">{error}</p>
      ) : (
        <>
          <video
            ref={mediaRef}
            src={src ?? undefined}
            controls={false}
            preload="metadata"
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setError('This lecture could not be played.')}
            className="max-h-[38vh] w-full bg-black"
          />

          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => {
                const media = mediaRef.current;
                if (!media) return;
                playing ? media.pause() : media.play().catch(() => undefined);
              }}
              aria-label={playing ? 'Pause' : 'Play'}
              className="shrink-0 rounded-full border border-line p-2 text-signal
                         transition-colors hover:border-signal hover:bg-signal/10"
            >
              {playing ? (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 3l16 9-16 9z" />
                </svg>
              )}
            </button>

            {/* The scrubber is the tape: ribs, cited passages, and the needle. */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              onClick={scrub}
              onKeyDown={(e) => {
                const media = mediaRef.current;
                if (!media) return;
                if (e.key === 'ArrowRight') media.currentTime += 5;
                if (e.key === 'ArrowLeft') media.currentTime -= 5;
              }}
              className="relative h-9 flex-1 cursor-pointer rounded border border-line bg-deck"
            >
              <div
                aria-hidden
                className="absolute inset-0 rounded opacity-30"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, rgba(233,240,245,0.12) 0 1px, transparent 1px 9px)',
                }}
              />

              {duration > 0 &&
                citations.map((citation, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="absolute bottom-0 h-[3px] rounded-full bg-signal/70"
                    style={{
                      left: `${Math.min(100, (citation.start / duration) * 100)}%`,
                      width: `${Math.max(
                        1,
                        ((citation.end - citation.start) / duration) * 100,
                      )}%`,
                    }}
                  />
                ))}

              <span
                aria-hidden
                className="absolute top-0 h-full w-[2px] bg-signal shadow-needle transition-[left] duration-100"
                style={{ left: `${Math.min(100, progress)}%` }}
              />
            </div>

            <span className="shrink-0 font-mono text-[0.7rem] tabular-nums text-muted">
              {clock(currentTime)} / {clock(duration)}
            </span>
          </div>
        </>
      )}
    </section>
  );
});

export default VideoPlayer;
