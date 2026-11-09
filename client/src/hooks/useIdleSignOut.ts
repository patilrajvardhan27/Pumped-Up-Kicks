'use client';

import { useEffect } from 'react';

const minutes = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES ?? 30);
export const IDLE_TIMEOUT_MS = (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60_000;

const KEY = 'puk-last-activity';
const CHECK_EVERY_MS = 30_000;
const WRITE_EVERY_MS = 15_000;
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/* Storage can be blocked (private windows, strict settings); fall back to this tab's memory. */
let memory = Date.now();

function readLast(): number {
  try {
    return Number(window.localStorage.getItem(KEY)) || memory;
  } catch {
    return memory;
  }
}

function writeLast(at: number): void {
  memory = at;
  try {
    window.localStorage.setItem(KEY, String(at));
  } catch {
    // Memory alone still protects this tab.
  }
}

/**
 * Signs the user out after a stretch with no interaction in any tab.
 *
 * Signing out ends the session everywhere, so activity is shared through local
 * storage: an idle background tab must not sign out the tab being used. The
 * API's session tokens live about a minute, so access stops shortly after.
 */
export function useIdleSignOut(enabled: boolean, signOut: () => Promise<unknown>): void {
  useEffect(() => {
    if (!enabled) return;

    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      if (now - lastWrite < WRITE_EVERY_MS) return;
      lastWrite = now;
      writeLast(now);
    };

    const check = () => {
      if (Date.now() - readLast() >= IDLE_TIMEOUT_MS) void signOut();
    };

    markActive();
    ACTIVITY.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    // A laptop waking from sleep should be checked at once, not on the next tick.
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      ACTIVITY.forEach((name) => window.removeEventListener(name, markActive));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [enabled, signOut]);
}
