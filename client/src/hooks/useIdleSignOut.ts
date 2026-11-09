'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useEffectEvent } from 'react';
import { read, STORAGE_KEYS, write } from '@/lib/persisted';

const DEFAULT_MINUTES = 30;
const minutes = Number(process.env.NEXT_PUBLIC_IDLE_MINUTES);
const IDLE_MS = (minutes > 0 ? minutes : DEFAULT_MINUTES) * 60_000;
const CHECK_MS = 30_000;
const WRITE_EVERY_MS = 10_000;

/** When any tab last saw the user, from the shared stamp. */
const lastSeen = (): number | null => {
  const stamp = Number(read(STORAGE_KEYS.lastActive));
  return Number.isFinite(stamp) && stamp > 0 ? stamp : null;
};

/**
 * Signs the user out after a stretch of inactivity. The last-seen time lives
 * in local storage, so activity in any tab keeps every tab signed in. Only
 * clicks, keys and the tab coming back count as activity; scrolling does not.
 */
export function useIdleSignOut() {
  const { isSignedIn, signOut } = useAuth();

  const expire = useEffectEvent(() => {
    void signOut({ redirectUrl: '/' });
  });

  useEffect(() => {
    if (!isSignedIn) return;
    let wrote = 0;

    const idle = () => {
      const seen = lastSeen();
      return seen !== null && Date.now() - seen > IDLE_MS;
    };

    const touch = () => {
      const now = Date.now();
      if (now - wrote < WRITE_EVERY_MS) return;
      wrote = now;
      write(STORAGE_KEYS.lastActive, String(now));
    };

    // Judge before recording, so a return after a long absence signs out
    // instead of quietly counting as activity.
    const onActivity = () => {
      if (idle()) expire();
      else touch();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onActivity();
    };

    if (idle()) expire();
    else touch();

    const timer = window.setInterval(() => {
      if (idle()) expire();
    }, CHECK_MS);
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isSignedIn]);
}
