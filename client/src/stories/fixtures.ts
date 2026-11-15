import type { Source, UsageSummary, VideoInfo } from '@/types/api';
import type { TranscriptLine } from '@/types/transcript';
import type { Turn } from '@/types/chat';

/* Made-up lecture data every story shared, so a change to a type broke one file, not twenty. */

export const LECTURE = { id: 7, title: 'Lecture 7: Training deep networks', duration: 3492 };
export const SECOND_LECTURE = { id: 6, title: 'Lecture 6: Optimisers', duration: 3240 };

export const VIDEOS: VideoInfo[] = [LECTURE, SECOND_LECTURE].map((lecture) => ({
  id: lecture.id,
  workspace_id: 1,
  filename: `lecture-${lecture.id}.mp4`,
  title: lecture.title,
  duration: lecture.duration,
  uploaded_at: '2026-11-02T10:00:00Z',
  file_size: 812_000_000,
  stage: 'ready',
  stage_label: 'Ready',
  progress: 100,
  num_chunks: 46,
}));

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** A lecture passage cited at `start` seconds. */
export function source(start: number, lecture = LECTURE, text = 'Each layer multiplies the gradient by a small derivative.'): Source {
  return {
    kind: 'video',
    chunk_id: start,
    video_id: lecture.id,
    video: lecture.title,
    video_duration: lecture.duration,
    text,
    start,
    end: start + 75,
    timestamp: `${clock(start)} - ${clock(start + 75)}`,
    similarity: 0.82,
  };
}

/** Twelve passages across two lectures, for the busiest citation lists. */
export const MANY_SOURCES: Source[] = Array.from({ length: 12 }, (_, i) =>
  source(190 + i * 240, i % 3 === 2 ? SECOND_LECTURE : LECTURE, `Passage ${i + 1}: why depth makes training harder.`),
);

export const ANSWER = `The gradient shrinks as it travels back through the network [12:04]. Each layer multiplies it by a derivative smaller than one, so after many layers it is close to zero [12:40].

The lecture gave three fixes:
- Residual connections let the gradient skip layers [24:15].
- Careful initialisation keeps the derivatives near one [31:02].
- Batch normalisation keeps activations in a healthy range [38:27].`;

export const ANSWER_SOURCES = [724, 760, 1455, 1862, 2307].map((start) => source(start));

/** One finished turn; pass changes for the streaming, failed and stopped variants. */
export function turn(change: Partial<Turn> = {}): Turn {
  return {
    key: 't1',
    question: 'Why does the gradient vanish in deep networks?',
    answer: ANSWER,
    sources: ANSWER_SOURCES,
    usage: { input_tokens: 2100, output_tokens: 180, cache_read_tokens: 0, cache_write_tokens: 0, model: 'model', cost_usd: 0.0091 },
    responseTime: 4.2,
    streaming: false,
    ...change,
  };
}

/** A long transcript: two hours of numbered lines, so the panel had to scroll and search. */
export const TRANSCRIPT: TranscriptLine[] = Array.from({ length: 120 }, (_, i) => ({
  start: i * 30,
  end: i * 30 + 30,
  text:
    i === 24
      ? 'So the gradient vanishes: each layer multiplies it by a derivative smaller than one.'
      : `Line ${i + 1}. We keep working through how a network learns its weights, one step at a time.`,
}));

/** A student close to the end of their monthly allowance. */
export const USAGE_NEAR_LIMIT: UsageSummary = {
  questions_asked: 84,
  cache_hits: 12,
  total_cost_usd: 0.92,
  total_input_tokens: 182_000,
  total_output_tokens: 15_400,
  model: 'model',
  quota: { plan: 'free', spent_usd: 0.92, limit_usd: 1, remaining_usd: 0.08, percent_used: 92, exhausted: false },
  content: { used_chunks: 470, limit_chunks: 500, remaining_chunks: 30, percent_used: 94 },
};
