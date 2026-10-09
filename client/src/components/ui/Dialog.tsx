'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A modal panel on the native <dialog> element, which brings focus trapping,
 * Escape to close and an inert page behind it without a library.
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className="m-auto max-h-[min(44rem,calc(100dvh-2rem))] w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-lg border border-hairline bg-canvas p-0 text-body shadow-window backdrop:bg-ink/40"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline-soft pr-2 pl-5">
            <h2 id={titleId} className="text-heading-sm text-ink">
              {title}
            </h2>
            <IconButton aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
