'use client';

import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';

interface ShortcutOptions {
  /** Subject ids in sidebar order; the first nine get Ctrl or Cmd + 1 to 9. */
  subjectIds: number[];
  onSelect: (id: number) => void;
  onToggleSidebar: () => void;
}

/**
 * Ctrl+1 to 9 (Cmd on a Mac) opens the subject in that position, as Arc does
 * with Spaces, and Ctrl+\ shows or hides the sidebar.
 *
 * Keys are matched by physical position (event.code), so they work on layouts
 * where the digits or the backslash need a modifier to type. Some browsers keep
 * Ctrl+digit for switching tabs and never pass it to the page; clicking still
 * works there.
 */
export function useWorkspaceShortcuts({ subjectIds, onSelect, onToggleSidebar }: ShortcutOptions) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;

    if (event.code === 'Backslash') {
      event.preventDefault();
      onToggleSidebar();
      return;
    }

    const digit = /^Digit([1-9])$/.exec(event.code);
    if (!digit) return;
    const id = subjectIds[Number(digit[1]) - 1];
    if (id === undefined) return;
    event.preventDefault();
    onSelect(id);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}

const noSubscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

/** "⌘" on Apple devices and "Ctrl" elsewhere, for shortcut hints. "Ctrl" until hydrated. */
export function useModifierLabel(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (isMac() ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}
