import type { Source } from '@/types/api';

const CLOCK = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;

/**
 * Matches a citation like [12:04], [1:02:33], or [0:00 - 0:35].
 *
 * Exactly one capture group, wrapping the whole citation, so String.split()
 * yields alternating text and citation pieces — an inner group would make it
 * emit each timestamp twice.
 */
export const CITATION_SPLIT = new RegExp(
  String.raw`(\[${CLOCK}(?:\s*[-–]\s*${CLOCK})?\])`,
  'g',
);

/** "12:04" -> 724, "1:02:33" -> 3753. Returns null for anything else. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Work out which lecture a citation points into.
 *
 * The model writes a bare timestamp, but an answer can draw on several
 * lectures, so the time alone is ambiguous. Resolve it against the excerpts
 * that were actually retrieved: prefer the one whose range contains the time,
 * and otherwise take the nearest start.
 */
export function resolveCitation(
  seconds: number,
  sources: Source[],
): { videoId: number; seconds: number } | null {
  const usable = sources.filter((s) => typeof s.video_id === 'number');
  if (usable.length === 0) return null;

  const containing = usable.find(
    (s) => seconds >= (s.start ?? 0) && seconds <= (s.end ?? Infinity),
  );
  if (containing) return { videoId: containing.video_id as number, seconds };

  const nearest = usable.reduce((best, candidate) =>
    Math.abs((candidate.start ?? 0) - seconds) < Math.abs((best.start ?? 0) - seconds)
      ? candidate
      : best,
  );

  return { videoId: nearest.video_id as number, seconds };
}
