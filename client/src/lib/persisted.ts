'use client';

import { useCallback, useSyncExternalStore } from 'react';

/*
 * Small UI preferences kept in local storage, such as whether the sidebar is
 * collapsed. Same approach as lib/consent.ts: read through
 * useSyncExternalStore, so the server render uses the fallback and other tabs
 * stay in step. If storage is blocked the value simply lasts for this page.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function write(key: string, value: string | null): void {
  memory.set(key, value);
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Kept in memory only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** A string remembered in this browser. `null` until a value has been stored. */
export function usePersistedString(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback((next: string | null) => write(key, next), [key]);
  return [value, set];
}
