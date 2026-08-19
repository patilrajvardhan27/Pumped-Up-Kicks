'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '@/services';
import { ApiError } from '@/services/api';
import { CITATION_SPLIT, parseClock, resolveCitation } from '@/lib/timestamps';
import type { Source, StreamEvent, Usage, VideoInfo } from '@/types/api';
import Alert from './Alert';
import TapeStrip from './TapeStrip';

interface Turn {
  key: string;
  question: string;
  answer: string;
  sources: Source[];
  usage?: Usage;
  responseTime?: number;
  costUsd?: number | null;
  streaming: boolean;
  error?: string;
}

interface ChatInterfaceProps {
  videos: VideoInfo[];
  /** Lecture the conversation is scoped to; null means all lectures. */
  videoId: number | null;
  conversationId: number | null;
  onConversationStarted: (id: number) => void;
  onTurnComplete: () => void;
  /** Jump the player to a moment in a lecture. */
  onSeek?: (videoId: number, seconds: number) => void;
  /** The latest answer's excerpts, so the player can mark them on its scrubber. */
  onSourcesChange?: (sources: Source[]) => void;
}

const STARTERS = [
  'Summarise the main argument',
  'What were the limitations?',
  'List every example worked through',
];

/**
 * Renders [12:04] citations as buttons that play the lecture from that moment.
 * Falls back to a plain chip when the citation can't be resolved to a lecture.
 */
function AnswerText({
  text,
  sources,
  onSeek,
}: {
  text: string;
  sources: Source[];
  onSeek?: (videoId: number, seconds: number) => void;
}) {
  const parts = text.split(CITATION_SPLIT);

  return (
    <p className="whitespace-pre-wrap leading-[1.7] text-ink">
      {parts.map((part, i) => {
        if (!part || !/^\[\d/.test(part)) return part;

        const label = part.slice(1, -1);
        const seconds = parseClock(label.split(/[-–]/)[0]);
        const target = seconds == null ? null : resolveCitation(seconds, sources);

        const chip =
          'mx-0.5 rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[0.8em] text-signal';

        if (!target || !onSeek) {
          return (
            <span key={i} className={chip}>
              {label}
            </span>
          );
        }

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(target.videoId, target.seconds)}
            title={`Play from ${label}`}
            className={`${chip} cursor-pointer align-baseline transition-colors
                        hover:border-signal hover:bg-signal/25`}
          >
            {label}
          </button>
        );
      })}
    </p>
  );
}

export default function ChatInterface({
  videos,
  videoId,
  conversationId,
  onConversationStarted,
  onTurnComplete,
  onSeek,
  onSourcesChange,
}: ChatInterfaceProps) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<Record<string, number | null>>({});

  const abortRef = useRef<AbortController | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // A conversation this component just opened by asking a question. Its
  // messages are only persisted once the stream finishes, so reloading it from
  // the server mid-stream would replace the answer being written with nothing.
  const selfStartedRef = useRef<number | null>(null);

  const durations: Record<string, number> = {};
  videos.forEach((v) => {
    if (v.duration) durations[v.title || v.filename] = v.duration;
  });

  const readyCount = videos.filter((v) => v.stage === 'ready').length;
  const hasContent = readyCount > 0;

  // Load an existing thread, or clear the pane for a new one.
  useEffect(() => {
    let cancelled = false;

    if (conversationId == null) {
      setTurns([]);
      return;
    }

    if (selfStartedRef.current === conversationId) {
      // We started this thread; what's on screen is newer than the server.
      selfStartedRef.current = null;
      return;
    }

    setLoadingThread(true);
    chatService
      .getConversation(conversationId)
      .then((detail) => {
        if (cancelled) return;
        const restored: Turn[] = [];
        for (let i = 0; i < detail.messages.length; i += 1) {
          const message = detail.messages[i];
          if (message.role !== 'user') continue;
          const reply = detail.messages[i + 1];
          restored.push({
            key: `m${message.id}`,
            question: message.content,
            answer: reply?.role === 'assistant' ? reply.content : '',
            // Citations come back from the database, so they survive a reload.
            sources: reply?.sources ?? [],
            costUsd: reply?.cost_usd ?? null,
            streaming: false,
          });
        }
        setTurns(restored);
      })
      .catch(() => {
        if (!cancelled) setTurns([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns]);

  // Mark the most recent answer's excerpts on the player's scrubber.
  const latestSources = turns.length ? turns[turns.length - 1].sources : null;
  useEffect(() => {
    if (latestSources) onSourcesChange?.(latestSources);
  }, [latestSources, onSourcesChange]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;

      const key = `t${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        { key, question: trimmed, answer: '', sources: [], streaming: true },
      ]);
      setQuestion('');
      setBusy(true);
      setQuotaError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const update = (patch: Partial<Turn>) =>
        setTurns((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));

      try {
        await chatService.streamQuery(
          {
            question: trimmed,
            top_k: 5,
            ...(conversationId != null
              ? { conversation_id: conversationId }
              : videoId != null
                ? { video_id: videoId }
                : {}),
          },
          (event: StreamEvent) => {
            if (event.type === 'conversation') {
              if (conversationId == null) {
                selfStartedRef.current = event.conversation_id;
                onConversationStarted(event.conversation_id);
              }
            } else if (event.type === 'sources') {
              update({ sources: event.sources });
            } else if (event.type === 'delta') {
              setTurns((prev) =>
                prev.map((t) => (t.key === key ? { ...t, answer: t.answer + event.text } : t)),
              );
            } else if (event.type === 'done') {
              update({
                answer: event.answer,
                sources: event.sources,
                usage: event.usage,
                responseTime: event.response_time,
                streaming: false,
              });
            } else if (event.type === 'error') {
              update({ error: event.message, streaming: false });
            }
          },
          controller.signal,
        );
        onTurnComplete();
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        if (err instanceof ApiError && err.status === 402) {
          setQuotaError(err.message);
          setTurns((prev) => prev.filter((t) => t.key !== key));
        } else {
          update({
            error: err instanceof Error ? err.message : 'The request did not complete.',
            streaming: false,
          });
        }
      } finally {
        setTurns((prev) => prev.map((t) => (t.key === key ? { ...t, streaming: false } : t)));
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, conversationId, videoId, onConversationStarted, onTurnComplete],
  );

  const jumpToSource = (turnKey: string, index: number, source?: Source) => {
    setActiveSource((prev) => ({ ...prev, [turnKey]: index }));
    sourceRefs.current[`${turnKey}:${index}`]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    if (source && onSeek && typeof source.video_id === 'number') {
      onSeek(source.video_id, source.start ?? 0);
    }
  };

  const scopeLabel = videoId
    ? videos.find((v) => v.id === videoId)?.title || 'this lecture'
    : 'all your lectures';

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loadingThread ? (
          <p className="py-10 font-mono text-sm text-faint">Loading chat…</p>
        ) : turns.length === 0 ? (
          <div className="flex flex-col py-10">
            <p className="eyebrow mb-4">
              {videoId ? `Asking ${scopeLabel}` : 'Start here'}
            </p>
            <h2 className="font-display text-display-md text-ink mb-3">
              {hasContent ? 'Ask the lecture something.' : 'Nothing to ask yet.'}
            </h2>
            <p className="max-w-lg text-muted leading-relaxed mb-8">
              {hasContent
                ? `Answers come back with the timestamp they were drawn from. This chat searches ${scopeLabel}.`
                : 'Add a lecture to your library. Once it finishes processing, every word of it becomes searchable.'}
            </p>

            {hasContent && (
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    onClick={() => ask(starter)}
                    className="rounded-full border border-line px-4 py-2 text-sm text-muted
                               transition-colors hover:border-signal/50 hover:text-signal"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10 py-2">
            {turns.map((turn) => (
              <article key={turn.key} className="animate-rise space-y-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-signal" aria-hidden />
                  <h3 className="font-display text-xl leading-snug text-ink">{turn.question}</h3>
                </div>

                <div className="ml-1 space-y-5 border-l border-line pl-5">
                  {turn.error ? (
                    <Alert variant="fault" title="Could not answer">
                      {turn.error}
                    </Alert>
                  ) : (
                    <>
                      {turn.answer ? (
                        <AnswerText
                          text={turn.answer}
                          sources={turn.sources}
                          onSeek={onSeek}
                        />
                      ) : (
                        <p className="flex items-center gap-2 font-mono text-sm text-faint">
                          <span className="h-1.5 w-1.5 animate-needle-pulse rounded-full bg-signal" />
                          reading the transcript…
                        </p>
                      )}

                      {turn.streaming && turn.answer && (
                        <span className="inline-block h-4 w-[2px] animate-needle-pulse bg-signal align-middle" />
                      )}

                      {!turn.streaming && turn.sources.length > 0 && (
                        <>
                          <TapeStrip
                            sources={turn.sources}
                            durations={durations}
                            activeIndex={activeSource[turn.key] ?? null}
                            onSelect={(index) =>
                              jumpToSource(turn.key, index, turn.sources[index])
                            }
                          />

                          <details className="group">
                            <summary className="eyebrow cursor-pointer list-none transition-colors hover:text-signal">
                              {turn.sources.length} excerpt{turn.sources.length === 1 ? '' : 's'} ·
                              read them
                            </summary>

                            <div className="mt-4 space-y-2">
                              {turn.sources.map((source, index) => (
                                <div
                                  key={source.chunk_id ?? index}
                                  ref={(el) => {
                                    sourceRefs.current[`${turn.key}:${index}`] = el;
                                  }}
                                  className={`rounded-lg border bg-well p-4 transition-colors ${
                                    activeSource[turn.key] === index
                                      ? 'border-signal/50'
                                      : 'border-line'
                                  }`}
                                >
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    {onSeek && typeof source.video_id === 'number' ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onSeek(source.video_id as number, source.start ?? 0)
                                        }
                                        title="Play from here"
                                        className="flex items-center gap-1.5 font-mono text-sm text-signal
                                                   transition-opacity hover:opacity-75"
                                      >
                                        <svg
                                          className="h-3 w-3"
                                          fill="currentColor"
                                          viewBox="0 0 24 24"
                                          aria-hidden
                                        >
                                          <path d="M5 3l16 9-16 9z" />
                                        </svg>
                                        {source.timestamp}
                                      </button>
                                    ) : (
                                      <span className="font-mono text-sm text-signal">
                                        {source.timestamp}
                                      </span>
                                    )}
                                    <span className="truncate font-mono text-xs text-faint">
                                      {source.video}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed text-muted">{source.text}</p>
                                  {typeof source.similarity === 'number' && (
                                    <p className="mt-2 font-mono text-[0.65rem] text-faint">
                                      match {(source.similarity * 100).toFixed(0)}%
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        </>
                      )}

                      {!turn.streaming && (turn.usage || turn.costUsd != null) && (
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.7rem] text-faint">
                          {turn.responseTime != null && <span>{turn.responseTime.toFixed(1)}s</span>}
                          {turn.usage && (
                            <span>
                              {turn.usage.input_tokens} in / {turn.usage.output_tokens} out
                            </span>
                          )}
                          <span>
                            ${(turn.usage?.cost_usd ?? turn.costUsd ?? 0).toFixed(5)}
                          </span>
                          {turn.usage?.model && <span>{turn.usage.model}</span>}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {quotaError && (
        <div className="mt-4 shrink-0">
          <Alert variant="fault" title="Monthly limit reached" onClose={() => setQuotaError(null)}>
            {quotaError}
          </Alert>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mt-6 shrink-0 space-y-2 border-t border-line pt-5"
      >
        <div className="flex gap-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={hasContent ? `Ask ${scopeLabel}…` : 'Add a lecture first'}
            disabled={busy || !hasContent}
            className="input-field flex-1 disabled:opacity-50"
            aria-label="Your question"
          />
          {busy ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="btn-ghost shrink-0">
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim() || !hasContent}
              className="btn-primary shrink-0"
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
