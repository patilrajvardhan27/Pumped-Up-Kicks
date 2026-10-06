'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useId, useRef, useState } from 'react';
import { AnswerIcon, AskIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { DURATION } from '@/lib/motion';
import { ChatPreview } from './ChatPreview';
import { HeroTimeline } from './HeroTimeline';

const TABS = [
  {
    key: 'find',
    label: 'Find the moment',
    Icon: AnswerIcon,
    heading: 'One lecture, thirteen mentions, one answer.',
    body: 'Scrub the sample lecture. The topic comes up all hour, but only one passage answers the question.',
  },
  {
    key: 'read',
    label: 'Read the answer',
    Icon: AskIcon,
    heading: 'Every claim points at a moment.',
    body: 'Timestamps in an answer are buttons. Pick one and the lecture plays from that second.',
  },
] as const;

/**
 * The product, shown two ways. A tabbed frame: the dark tab strip and border
 * are one shape, and a single highlight slides between the tabs.
 */
export function Showcase() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const tab = TABS[active];

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (active + step + TABS.length) % TABS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="preview" aria-label="Product preview" className="scroll-mt-6 px-4 sm:px-8">
      <div className="rounded-lg bg-surface-dark p-1.5">
        <div role="tablist" aria-label="Preview" onKeyDown={handleKeyDown} className="flex gap-1">
          {TABS.map(({ key, label, Icon }, index) => {
            const selected = index === active;
            return (
              <button
                key={key}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${key}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                className={cn(
                  'relative flex h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-button-md focus-on-dark',
                  selected ? 'text-on-primary' : 'text-on-dark hover:text-primary',
                )}
              >
                {selected && (
                  <m.span
                    layoutId={`${baseId}-highlight`}
                    className="absolute inset-0 rounded-md bg-primary"
                  />
                )}
                <span className="relative flex min-w-0 items-center gap-2">
                  <Icon className="hidden size-5 sm:block" />
                  <span className="truncate">{label}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`${baseId}-panel`}
          aria-labelledby={`${baseId}-tab-${tab.key}`}
          className="mt-1.5 overflow-hidden rounded-md bg-canvas p-4 sm:p-6"
        >
          <AnimatePresence initial={false} mode="wait">
            <m.div
              key={tab.key}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: DURATION.fast }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-display-lg text-ink">{tab.heading}</h2>
                <p className="max-w-[60ch] text-body-sm text-body">{tab.body}</p>
              </div>
              {tab.key === 'find' ? <HeroTimeline /> : <ChatPreview />}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
