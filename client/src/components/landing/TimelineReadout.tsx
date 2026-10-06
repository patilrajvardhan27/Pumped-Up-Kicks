'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { AnswerIcon, DragIcon, WaveformIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { DURATION } from '@/lib/motion';
import { MENTIONS } from './hero-timeline-data';

/**
 * What the lecturer is saying under the needle. Swaps as the needle moves from
 * one mention to the next; its height is fixed so the page never shifts.
 */
export function TimelineReadout({ index }: { index: number | null }) {
  const mention = index == null ? null : MENTIONS[index];
  const isAnswer = Boolean(mention?.answer);

  return (
    <div
      aria-live="polite"
      className={cn(
        'card relative h-32 overflow-hidden sm:h-24',
        isAnswer && 'border-primary-active bg-surface-doc',
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.div
          key={index ?? 'none'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: DURATION.fast }}
          className="absolute inset-0 flex items-start gap-3 p-4"
        >
          {mention ? (
            <>
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md',
                  isAnswer ? 'bg-primary text-on-primary' : 'bg-surface-soft text-ink',
                )}
              >
                {isAnswer ? <AnswerIcon className="size-5" /> : <WaveformIcon className="size-5" />}
              </span>
              <div className="min-w-0">
                <p className="eyebrow">
                  {isAnswer ? 'The answer' : `Mention ${(index ?? 0) + 1} of ${MENTIONS.length}`}
                  <span className="ml-2 font-mono tabular-nums">{formatClock(mention.seconds)}</span>
                </p>
                <p className="mt-1 line-clamp-3 text-body-sm text-ink sm:line-clamp-2">
                  &ldquo;{mention.quote}&rdquo;
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-soft text-mute-strong">
                <DragIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="eyebrow">Nothing about it here</p>
                <p className="mt-1 text-body-sm text-body">
                  Most of an hour is not your answer. Keep dragging, or use the arrow keys.
                </p>
              </div>
            </>
          )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
