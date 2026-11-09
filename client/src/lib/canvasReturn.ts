'use client';

/*
 * After the Canvas sign-in, the API sends the browser back to
 * /app?canvas_code=...&canvas_state=... (or /app?canvas_error=denied|invalid|failed).
 * This reads that once and takes it out of the address bar straight away, so
 * the one-time code never sits in history or gets reloaded.
 */
import { useSyncExternalStore } from 'react';

export type CanvasReturn =
  | { kind: 'code'; code: string; state: string }
  | { kind: 'error'; error: 'denied' | 'invalid' | 'failed' };

const ERRORS = ['denied', 'invalid', 'failed'] as const;
const PARAMS = ['canvas_code', 'canvas_state', 'canvas_error'];

let captured: CanvasReturn | null | undefined;
let completing = false;

function read(): CanvasReturn | null {
  if (captured !== undefined) return captured;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('canvas_code');
  const state = url.searchParams.get('canvas_state');
  const error = url.searchParams.get('canvas_error');
  if (!PARAMS.some((name) => url.searchParams.has(name))) {
    captured = null;
    return null;
  }

  PARAMS.forEach((name) => url.searchParams.delete(name));
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);

  if (code && state) captured = { kind: 'code', code, state };
  else captured = { kind: 'error', error: ERRORS.find((each) => each === error) ?? 'failed' };
  return captured;
}

const noSubscribe = () => () => {};

/** The Canvas return from the address bar, scrubbed on first read. Null on the server. */
export function useCanvasReturn(): CanvasReturn | null {
  return useSyncExternalStore(noSubscribe, read, () => null);
}

/** True once per page load, so a strict-mode double effect cannot spend the code twice. */
export function claimCompletion(): boolean {
  if (completing) return false;
  completing = true;
  return true;
}

/** Plain-language text for each error the API can send back. */
export const CANVAS_ERROR_TEXT: Record<'denied' | 'invalid' | 'failed', { tone: 'info' | 'danger'; title: string; text: string }> = {
  denied: {
    tone: 'info',
    title: "Canvas wasn't connected",
    text: "You didn't allow access in Canvas, so nothing was imported. Connect again whenever you're ready.",
  },
  invalid: {
    tone: 'danger',
    title: "Canvas wasn't connected",
    text: 'That sign-in link expired or was already used. Choose Continue to Canvas to start again.',
  },
  failed: {
    tone: 'danger',
    title: "Canvas wasn't connected",
    text: "Canvas didn't finish signing you in. Try again in a moment.",
  },
};
