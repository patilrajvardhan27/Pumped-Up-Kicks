'use client';

import { animate, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { DragIcon } from '@/components/ui/icons';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { EASE, SNAP_SPRING } from '@/lib/motion';
import {
  ANSWER_INDEX,
  ANSWER_POSITION,
  MENTIONS,
  QUESTION,
  RUNTIME_SECONDS,
  mentionAt,
  positionOf,
} from './hero-timeline-data';
import { TimelineReadout } from './TimelineReadout';
import { Waveform } from './Waveform';

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const percent = (value: number) => `${value * 100}%`;
const describe = (position: number, index: number | null) =>
  `${formatClock(position * RUNTIME_SECONDS)}${index === ANSWER_INDEX ? ', the answer' : index != null ? ', a mention' : ''}`;

/**
 * An hour of lecture as a strip you can scrub. Drag the needle (or use the
 * arrow keys) and the readout shows what is being said there; one mention is
 * the answer. Position is a motion value, so dragging never re-renders React:
 * only landing on a different mention does.
 */
export function HeroTimeline() {
  const reduceMotion = useReducedMotion();
  const position = useMotionValue(ANSWER_POSITION);
  const [focused, setFocused] = useState<number | null>(ANSWER_INDEX);

  const stripRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const reported = useRef(false);

  // Counted once per visit: the first time someone actually moves the needle.
  const reportScrub = () => {
    if (reported.current) return;
    reported.current = true;
    track('timeline_scrubbed', {});
  };
  const introRunning = useRef(false);

  // Everything that follows the needle moves by transform alone.
  const needleX = useTransform(position, percent);
  const chipX = useTransform(position, (value) => percent(-value));
  const playedX = useTransform(position, (value) => percent(value - 1));
  const playedCounterX = useTransform(position, (value) => percent(1 - value));

  useMotionValueEvent(position, 'change', (value) => {
    if (clockRef.current) clockRef.current.textContent = formatClock(value * RUNTIME_SECONDS);
    if (introRunning.current) return;
    const index = mentionAt(value);
    setFocused(index);
    stripRef.current?.setAttribute('aria-valuenow', String(Math.round(value * RUNTIME_SECONDS)));
    stripRef.current?.setAttribute('aria-valuetext', describe(value, index));
  });

  // On load the needle sweeps the lecture and lands on the answer.
  useEffect(() => {
    needleRef.current?.setAttribute('data-intro', 'done');
    if (reduceMotion) return;

    introRunning.current = true;
    position.jump(0);
    const sweep = animate(position, ANSWER_POSITION, { duration: 1.5, delay: 0.5, ease: EASE });
    sweep.then(() => {
      introRunning.current = false;
    });
    return () => {
      sweep.stop();
      introRunning.current = false;
    };
  }, [position, reduceMotion]);

  const moveTo = (target: number, spring = true) => {
    introRunning.current = false;
    if (spring && !reduceMotion) animate(position, clamp(target), SNAP_SPRING);
    else position.set(clamp(target));
  };

  const positionFromPointer = (event: React.PointerEvent) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return clamp((event.clientX - bounds.left) / bounds.width);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const here = position.get();
    const next = MENTIONS.find((mention) => positionOf(mention) > here + 0.001);
    const previous = [...MENTIONS].reverse().find((mention) => positionOf(mention) < here - 0.001);
    const targets: Record<string, number | undefined> = {
      ArrowRight: next ? positionOf(next) : 1,
      ArrowLeft: previous ? positionOf(previous) : 0,
      Home: 0,
      End: 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    reportScrub();
    moveTo(target);
  };

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-body-sm text-ink">
          <span className="text-mute-strong">Asked: </span>
          {QUESTION}
        </span>
        <span className="inline-flex items-center gap-1.5 text-caption-sm text-mute-strong">
          <DragIcon />
          Drag the needle
        </span>
      </figcaption>

      {/* Space above the strip is reserved for the timestamp chip. */}
      <div
        ref={stripRef}
        role="slider"
        tabIndex={0}
        aria-label="Scrub the sample lecture"
        aria-valuemin={0}
        aria-valuemax={RUNTIME_SECONDS}
        aria-valuenow={Math.round(ANSWER_POSITION * RUNTIME_SECONDS)}
        aria-valuetext={describe(ANSWER_POSITION, ANSWER_INDEX)}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          reportScrub();
          position.stop();
          moveTo(positionFromPointer(event), false);
        }}
        onPointerMove={(event) => {
          if (dragging.current) moveTo(positionFromPointer(event), false);
        }}
        onPointerUp={() => {
          dragging.current = false;
          const index = mentionAt(position.get());
          if (index != null) moveTo(positionOf(MENTIONS[index]));
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        className="relative mt-9 h-20 cursor-grab touch-pan-y rounded-md bg-surface-dark select-none active:cursor-grabbing sm:h-24"
      >
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <Waveform className="bg-on-dark/15" />
          {/* The played part: a window that slides open over a brighter copy. */}
          <m.div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ x: playedX }}>
            <m.div className="absolute inset-0" style={{ x: playedCounterX }}>
              <Waveform className="bg-on-dark/45" />
            </m.div>
          </m.div>
        </div>

        {MENTIONS.map((mention, index) => (
          <span
            key={mention.seconds}
            aria-hidden="true"
            className={cn(
              'stagger absolute -ml-px w-0.5 animate-mark-in rounded-full transition-transform',
              mention.answer ? 'inset-y-0 -ml-0.5 w-1 bg-primary' : 'inset-y-5 bg-on-dark',
              focused === index && !mention.answer && 'scale-y-150',
            )}
            style={{ left: percent(positionOf(mention)), '--i': index } as CSSProperties}
          />
        ))}

        <m.div
          ref={needleRef}
          data-intro="pending"
          className="pointer-events-none absolute -top-9 right-0 bottom-0 left-0"
          style={{ x: needleX }}
        >
          <span className="absolute top-9 bottom-0 -left-px w-0.5 bg-on-dark" />
          <m.span
            className={cn(
              'absolute top-0 left-0 rounded-sm px-2 py-0.5 font-mono text-code-sm font-medium tabular-nums',
              focused === ANSWER_INDEX ? 'bg-primary text-on-primary' : 'bg-surface-dark text-on-dark',
            )}
            style={{ x: chipX }}
          >
            <span ref={clockRef} className="inline-block min-w-[5ch] text-center">
              {formatClock(ANSWER_POSITION * RUNTIME_SECONDS)}
            </span>
          </m.span>
        </m.div>
      </div>

      <div className="flex justify-between font-mono text-code-xs tabular-nums text-mute-strong">
        <span>0:00</span>
        <span>{formatClock(RUNTIME_SECONDS)}</span>
      </div>

      <TimelineReadout index={focused} />
    </figure>
  );
}
