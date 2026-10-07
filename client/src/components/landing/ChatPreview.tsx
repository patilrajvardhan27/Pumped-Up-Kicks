'use client';

import { AnimatePresence, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AnswerText } from '@/components/workspace/chat/AnswerText';
import { TimelineStrip } from '@/components/workspace/video/TimelineStrip';
import { DURATION } from '@/lib/motion';
import type { Source } from '@/types/api';

/*
 * Sample data for the landing page. The components that render it are the
 * workspace's own, so the preview behaves exactly like the product.
 */
const LECTURE = 'Week 4: Optimisation';
const RUNTIME = { [LECTURE]: 4000 };

const SOURCES: Source[] = [
  {
    video_id: 1,
    video: LECTURE,
    timestamp: '12:04',
    start: 724,
    end: 790,
    text: 'On a steep region the gradient is large, so the updates are large.',
  },
  {
    video_id: 1,
    video: LECTURE,
    timestamp: '34:12',
    start: 2052,
    end: 2110,
    text: 'It stalls because this is a saddle point: the gradient is close to zero in every direction.',
  },
  {
    video_id: 1,
    video: LECTURE,
    timestamp: '36:40',
    start: 2200,
    end: 2262,
    text: 'Momentum carries the update through the flat region.',
  },
];

const ANSWER =
  'It stalls because the loss surface flattens into a saddle point, where the gradient is close to zero in every direction [34:12]. ' +
  'The lecturer contrasts this with the steep region covered earlier [12:04], then shows momentum carrying the update through [36:40].';

const WORDS = ANSWER.split(' ');
const WORD_MS = 90;
const ANSWERING_SOURCE = 1;

/**
 * The chat, replayed: the answer streams in word by word as it does in the
 * product, then its citations draw onto the lecture timeline. Pick a timestamp
 * and the lit mark slides to it while the excerpt underneath swaps.
 */
export function ChatPreview() {
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(0);
  const [active, setActive] = useState(ANSWERING_SOURCE);

  const shown = reduceMotion ? WORDS.length : typed;
  const streaming = shown < WORDS.length;

  useEffect(() => {
    if (reduceMotion || typed >= WORDS.length) return;
    const timer = setTimeout(() => setTyped((count) => count + 1), WORD_MS);
    return () => clearTimeout(timer);
  }, [typed, reduceMotion]);

  const replay = () => {
    setActive(ANSWERING_SOURCE);
    setTyped(0);
  };

  const activateAt = (_videoId: number, seconds: number) => {
    const index = SOURCES.findIndex(
      (source) => seconds >= (source.start ?? 0) && seconds <= (source.end ?? 0),
    );
    if (index !== -1) setActive(index);
  };

  return (
    <div className="card flex flex-col gap-5 bg-surface-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-heading-sm text-ink">Why does gradient descent stall here?</h3>
        <Button variant="tertiary" size="sm" onClick={replay} disabled={streaming}>
          Replay
        </Button>
      </div>

      <div className="flex flex-col gap-5 border-l-2 border-hairline-soft pl-4">
        {/* An invisible full copy holds the final height, so streaming never shifts the page. */}
        <div className="grid *:col-start-1 *:row-start-1">
          <div aria-hidden="true" className="invisible">
            <AnswerText text={ANSWER} sources={SOURCES} />
          </div>
          <div>
            <AnswerText
              text={WORDS.slice(0, shown).join(' ')}
              sources={SOURCES}
              onSeek={streaming ? undefined : activateAt}
            />
            {streaming && (
              <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-0.5 animate-pulse-dot bg-ink align-middle" />
            )}
          </div>
        </div>

        {/* Always laid out; it fades up once the answer has finished. */}
        <m.div
          initial={false}
          animate={{ opacity: streaming ? 0 : 1, y: streaming ? 12 : 0 }}
          transition={{ duration: DURATION.slow }}
          inert={streaming}
          className="flex flex-col gap-4"
        >
          <TimelineStrip sources={SOURCES} durations={RUNTIME} activeIndex={active} onSelect={setActive} />

          <div aria-live="polite" className="relative h-24 overflow-hidden rounded-md bg-surface-soft sm:h-16">
            <AnimatePresence initial={false} mode="popLayout">
              <m.p
                key={active}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.fast }}
                className="absolute inset-0 flex items-center gap-3 px-4 text-body-xs text-ink"
              >
                <span className="shrink-0 rounded-sm bg-surface-dark px-1.5 py-0.5 font-mono text-code-xs tabular-nums text-on-dark">
                  {SOURCES[active].timestamp}
                </span>
                <span className="line-clamp-3 sm:line-clamp-2">&ldquo;{SOURCES[active].text}&rdquo;</span>
              </m.p>
            </AnimatePresence>
          </div>
        </m.div>
      </div>

      <p className="text-caption-sm text-mute-strong">Sample answer, replayed from saved data.</p>
    </div>
  );
}
