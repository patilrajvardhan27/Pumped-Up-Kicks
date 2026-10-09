import type { Source } from '@/types/api';

const CLOCK = String.raw`\d{1,2}:\d{2}(?::\d{2})?`;

/**
 * Matches a lecture citation like [12:04], [1:02:33] or [0:00 - 0:35], and a
 * course-document citation like [Doc 3].
 *
 * Exactly one capture group, wrapping the whole citation, so String.split()
 * yields alternating text and citation pieces — an inner group would make it
 * emit each timestamp twice.
 */
export const CITATION_SPLIT = new RegExp(
  String.raw`(\[(?:${CLOCK}(?:\s*[-–]\s*${CLOCK})?|Doc\s+\d{1,3})\])`,
  'g',
);

/** "[Doc 3]" -> 3. Null for anything else. */
export function docNumber(citation: string): number | null {
  const match = /^\[Doc\s+(\d{1,3})\]$/.exec(citation.trim());
  return match ? Number(match[1]) : null;
}

/** The document passage an answer cites as [Doc n]: the n-th excerpt it was given. */
export function resolveDocument(n: number, sources: Source[]): Source | null {
  const byRef = sources.find((source) => source.kind === 'document' && source.ref === `Doc ${n}`);
  if (byRef) return byRef;
  const byPosition = sources[n - 1];
  return byPosition?.kind === 'document' ? byPosition : null;
}

/** Only https links to the source are ever rendered. */
export function safeUrl(url: string | null | undefined): string | null {
  return url && url.startsWith('https://') ? url : null;
}

/** "Lecture notes week 1.pdf, p. 2" */
export function documentLabel(source: Source): string {
  const title = source.document_title || source.video;
  return source.timestamp ? `${title}, ${source.timestamp}` : title;
}

/** "12:04" -> 724, "1:02:33" -> 3753. Returns null for anything else. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p))) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
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
