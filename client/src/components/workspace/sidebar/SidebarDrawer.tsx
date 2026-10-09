'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Must match Tailwind's lg breakpoint, where the sidebar sits beside the library instead. */
const DESKTOP = '(min-width: 64rem)';

/**
 * The subject list on narrow screens. A native modal <dialog> gives focus
 * trapping, Escape to close and an inert page behind it without a library.
 */
export function SidebarDrawer({ open, onClose, children }: SidebarDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Widening the window past the breakpoint shows the inline sidebar, so the drawer goes.
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP);
    const widened = () => {
      if (query.matches) onClose();
    };
    query.addEventListener('change', widened);
    return () => query.removeEventListener('change', widened);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      aria-label="Subjects"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className="m-0 h-dvh max-h-none w-[min(20rem,88vw)] max-w-none bg-transparent p-2 backdrop:bg-ink/40"
    >
      {open && children}
    </dialog>
  );
}
