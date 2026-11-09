'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/services/api';

export type ServerState = 'checking' | 'online' | 'no-key' | 'no-db' | 'offline';

const POLL_MS = 30000;

/** Polls the API health endpoint and reports what, if anything, is missing. */
export function useServerStatus(): { state: ServerState; model: string } {
  const [state, setState] = useState<ServerState>('checking');
  const [model, setModel] = useState('');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.HEALTH);
        if (!response.ok) throw new Error('bad status');
        const body: { model?: string; database?: string; claude_configured?: boolean } =
          await response.json();
        if (cancelled) return;
        setModel(body.model || '');
        if (body.database !== 'ok') setState('no-db');
        else setState(body.claude_configured ? 'online' : 'no-key');
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

  return { state, model };
}
