'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/services/api';

export type ServerState = 'checking' | 'online' | 'no-db' | 'offline';

const POLL_MS = 30000;

/**
 * Polled the API's health check. The server only says "ok" or "degraded"
 * (degraded meant the database was unreachable), so that was all we read.
 */
export function useServerStatus(): ServerState {
  const [state, setState] = useState<ServerState>('checking');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.HEALTH);
        if (!response.ok) throw new Error('bad status');
        const body: { status?: string } = await response.json();
        if (!cancelled) setState(body.status === 'ok' ? 'online' : 'no-db');
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
