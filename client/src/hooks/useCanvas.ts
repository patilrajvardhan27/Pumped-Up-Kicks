'use client';

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { ApiError } from '@/services/api';
import { canvasService } from '@/services/canvasService';
import type { CanvasCourse, CanvasStatus, CanvasSyncRequest } from '@/types/api';

const POLL_MS = 2000;

const messageOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

const isRunning = (status: CanvasStatus | null) =>
  status?.sync?.stage === 'queued' || status?.sync?.stage === 'syncing';

/**
 * The Canvas connection and its sync. Polls while a sync runs, like the
 * lecture library does while a lecture processes, and calls `onSynced` when
 * one finishes so subjects and course material can reload.
 */
export function useCanvas(onSynced?: () => void) {
  const [status, setStatus] = useState<CanvasStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [polling, setPolling] = useState(false);
  // Whether the last status seen was mid-sync, to notice the moment it ends.
  const runningRef = useRef(false);

  const finished = useEffectEvent(() => onSynced?.());

  useEffect(() => {
    let cancelled = false;
    canvasService
      .status()
      .then((next) => {
        if (cancelled) return;
        setStatus(next);
        const now = isRunning(next);
        if (runningRef.current && !now) finished();
        runningRef.current = now;
        setPolling(now);
      })
      .catch(() => {
        // The rest of the app reports an unreachable API; Canvas stays quiet.
      });
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const running = isRunning(status) || polling;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setReloadCount((count) => count + 1), POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  const act = useCallback(async <T>(work: () => Promise<T>, fallback: string): Promise<T | null> => {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (err) {
      setError(messageOf(err, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Sends the browser to the school's Canvas sign-in. */
  const signIn = useCallback(
    async (baseUrl: string) => {
      const url = await act(() => canvasService.startSignIn(baseUrl), 'Could not start the Canvas sign-in.');
      if (url) window.location.assign(url);
    },
    [act],
  );

  const connectWithToken = useCallback(
    async (baseUrl: string, token: string) => {
      const next = await act(() => canvasService.connectWithToken(baseUrl, token), 'Could not connect to Canvas.');
      if (next) setStatus(next);
      return next !== null;
    },
    [act],
  );

  const sync = useCallback(
    async (request: CanvasSyncRequest = {}) => {
      const next = await act(() => canvasService.sync(request), 'Could not start the sync.');
      if (next) {
        setStatus(next);
        runningRef.current = true;
        setPolling(true);
      }
      return next !== null;
    },
    [act],
  );

  const disconnect = useCallback(
    async (deleteMaterial: boolean) => {
      const done = await act(() => canvasService.disconnect(deleteMaterial), 'Could not disconnect Canvas.');
      if (done) {
        setReloadCount((count) => count + 1);
        onSynced?.();
      }
      return done !== null;
    },
    [act, onSynced],
  );

  const clearError = useCallback(() => setError(null), []);

  return { status, error, clearError, busy, signIn, connectWithToken, sync, disconnect };
}

/** The student's active Canvas courses, loaded when `enabled` turns on and again whenever `version` changes. */
export function useCanvasCourses(enabled: boolean, version?: string | null) {
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    canvasService
      .courses()
      .then((items) => {
        if (!cancelled) {
          setCourses(items);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Could not load your Canvas courses.'));
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, version]);

  return { courses, error };
}
