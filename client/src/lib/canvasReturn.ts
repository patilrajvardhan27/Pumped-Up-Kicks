'use client';

import { useSyncExternalStore } from 'react';

/*
 * After the Canvas sign-in, the API sends the browser back to
 * /app?canvas=connected (or denied, or error&reason=...). This reads that once,
 * then takes it out of the address bar so a reload doesn't repeat it.
 */
export interface CanvasReturn {
  outcome: 'connected' | 'denied' | 'error';
  reason: string | null;
}

let captured: CanvasReturn | null | undefined;

function read(): CanvasReturn | null {
  if (captured === undefined) {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('canvas');
    captured =
      outcome === 'connected' || outcome === 'denied' || outcome === 'error'
        ? { outcome, reason: params.get('reason') }
        : null;
    if (captured) window.history.replaceState(null, '', window.location.pathname);
  }
  return captured;
}

const noSubscribe = () => () => {};

export function useCanvasReturn(): CanvasReturn | null {
  return useSyncExternalStore(noSubscribe, read, () => null);
}
