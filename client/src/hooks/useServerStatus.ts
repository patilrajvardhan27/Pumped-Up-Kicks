'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/services/api';
import type { HealthResponse } from '@/types/api';

export type ServerState = 'checking' | 'online' | 'no-key' | 'no-db' | 'offline';

const POLL_MS = 30000;

/** Polls the API health endpoint and reports what, if anything, is missing. */
export function useServerStatus(): ServerState {
  const [state, setState] = useState<ServerState>('checking');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.HEALTH);
        if (!response.ok) throw new Error('bad status');
        const body: HealthResponse = await response.json();
        if (cancelled) return;
        if (body.database !== 'ok') setState('no-db');
        else setState(body.ready ? 'online' : 'no-key');
      } catch {
        if (!cancelled) setState('offline');
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return state;
}
