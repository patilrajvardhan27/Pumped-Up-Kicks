import type { StreamEvent } from '@/types/api';
import { ANSWER, ANSWER_SOURCES } from './fixtures';

/**
 * A recorded /api/chat/stream response, in the order the server sends it: the
 * thread id, the sources, the answer in small pieces, then the final event.
 */
export function recordedAnswer(answer = ANSWER, sources = ANSWER_SOURCES): StreamEvent[] {
  const pieces = answer.match(/\S+\s*/g) ?? [];
  return [
    { type: 'conversation', conversation_id: 101 },
    { type: 'sources', sources },
    ...pieces.map((text): StreamEvent => ({ type: 'delta', text })),
    {
      type: 'done',
      answer,
      sources,
      num_sources: sources.length,
      response_time: 3.8,
      usage: { input_tokens: 2100, output_tokens: 180, cache_read_tokens: 0, cache_write_tokens: 0, model: 'model', cost_usd: 0.0091 },
    },
  ];
}

/** Replayed events as server-sent events, one every `delayMs`, the way the API streams them. */
export function sseStream(events: StreamEvent[], delayMs = 40): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new ReadableStream({
    start(controller) {
      let index = 0;
      const next = () => {
        if (index === events.length) return controller.close();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[index++])}\n\n`));
        timer = setTimeout(next, delayMs);
      };
      next();
    },
    cancel() {
      clearTimeout(timer);
    },
  });
}
