'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the visitor has agreed to analytics. Nothing optional runs until
 * this is 'granted', and 'unset' (no recorded choice) counts as no.
 *
 * 'pending' only exists on the server and during hydration, before the stored
 * choice can be read, so the banner never flashes for someone who already chose.
 */
export type Consent = 'granted' | 'denied' | 'unset';
type ConsentState = Consent | 'pending';

const KEY = 'puk-consent-v1';
const listeners = new Set<() => void>();

function read(): Consent {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unset';
  } catch {
    // Storage can be blocked; behave as if no choice was made.
    return 'unset';
  }
}

export function writeConsent(value: Consent): void {
  try {
    if (value === 'unset') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    // The choice then only lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the choice.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useConsent(): ConsentState {
  return useSyncExternalStore<ConsentState>(subscribe, read, () => 'pending');
}
