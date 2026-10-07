'use client';

import { animate, useDragControls, useMotionValue } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { DragIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { SNAP_SPRING } from '@/lib/motion';

interface AppWindowProps {
  title: string;
  children: ReactNode;
}

/* How far the window may be pulled from where it was laid out, in pixels. */
const REACH = { left: -140, right: 140, top: -8, bottom: 96 };
const WIDE_SCREEN = '(min-width: 64rem)';

/**
 * The window the landing page lives in. On large screens it can be dragged
 * around the desktop by its title bar and scrolls its own content; on small
 * screens it is an ordinary block in the page.
 */
export function AppWindow({ title, children }: AppWindowProps) {
  const controls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [moved, setMoved] = useState(false);
  const [wide, setWide] = useState(false);

  const recentre = () => {
    animate(x, 0, SNAP_SPRING);
    animate(y, 0, SNAP_SPRING);
    setMoved(false);
  };

  return (
    <m.div
      drag
      dragListener={false}
      dragControls={controls}
      dragConstraints={REACH}
      dragElastic={0.12}
      dragMomentum={false}
      onDragStart={() => setMoved(true)}
      whileDrag={{ scale: 1.01 }}
      style={{ x, y }}
      className={cn(
        'mx-auto flex w-full min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-canvas shadow-window lg:min-h-0 lg:flex-1',
        !wide && 'lg:max-w-5xl',
      )}
    >
      <div
        onPointerDown={(event) => {
          if (window.matchMedia(WIDE_SCREEN).matches) controls.start(event);
        }}
        onDoubleClick={() => setWide((value) => !value)}
        className="flex h-10 shrink-0 touch-none items-center justify-between gap-3 border-b border-hairline-soft bg-surface-soft pr-1 pl-4 select-none lg:cursor-grab lg:active:cursor-grabbing"
      >
        <span aria-hidden="true" className="truncate text-caption-sm text-mute-strong">
          {title}
        </span>
        <div role="region" aria-label="Window controls" className="hidden items-center lg:flex">
          {moved && (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={recentre}
              className="mr-1 h-7 rounded-sm px-2 text-caption-sm text-ink hover:bg-surface-card"
            >
              Recentre
            </button>
          )}
          <IconButton
            aria-label={wide ? 'Narrow the window' : 'Widen the window'}
            aria-pressed={wide}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setWide((value) => !value)}
            className="size-8"
          >
            <DragIcon />
          </IconButton>
        </div>
      </div>

      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 scroll-pt-6 scroll-smooth lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
      >
        {children}
      </main>
    </m.div>
  );
}
