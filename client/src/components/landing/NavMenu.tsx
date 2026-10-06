'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DURATION } from '@/lib/motion';
import { MENUS } from './nav-data';

interface NavMenuProps {
  /** The button's contents. */
  trigger: ReactNode;
  label: string;
  menu: keyof typeof MENUS;
  /** Which edge of the button the panel lines up with. */
  align?: 'start' | 'end';
  triggerClassName?: string;
}

/**
 * A disclosure menu: a button that reveals a panel of links. Closes on Escape
 * (returning focus), on a click outside, when focus leaves, and after a choice.
 */
export function NavMenu({ trigger, label, menu, align = 'start', triggerClassName }: NavMenuProps) {
  const items = MENUS[menu];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Listened for on the document: Safari does not focus a button on click,
    // so a handler on the menu itself would miss Escape there.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-body-xs font-semibold text-ink',
          'transition-transform hover:bg-surface-soft active:scale-95',
          open && 'bg-surface-soft',
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <m.ul
            id={panelId}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: DURATION.fast }}
            className={cn(
              'card absolute top-full mt-2 flex w-64 flex-col gap-0.5 p-1.5',
              align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            )}
          >
            {items.map(({ href, label: itemLabel, description, Icon }) => (
              <li key={`${href}-${itemLabel}`}>
                <a
                  href={href}
                  onClick={() => setOpen(false)}
                  className="group/item flex items-center gap-3 rounded-sm p-2 hover:bg-surface-soft"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-soft text-ink transition-transform group-hover/item:scale-110 group-hover/item:bg-surface-card">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-xs font-semibold text-ink">{itemLabel}</span>
                    <span className="block truncate text-caption-sm text-mute-strong">{description}</span>
                  </span>
                </a>
              </li>
            ))}
          </m.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
