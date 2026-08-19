'use client';

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/services';

type State = 'checking' | 'online' | 'no-key' | 'no-db' | 'offline';

const COPY: Record<State, { label: string; dot: string; text: string }> = {
  checking: { label: 'Connecting', dot: 'bg-faint', text: 'text-faint' },
  online: { label: 'Live', dot: 'bg-live', text: 'text-live' },
  'no-key': { label: 'No API key', dot: 'bg-signal', text: 'text-signal' },
  'no-db': { label: 'No database', dot: 'bg-fault', text: 'text-fault' },
  offline: { label: 'Server offline', dot: 'bg-fault', text: 'text-fault' },
};

export default function ServerStatus() {
  const [state, setState] = useState<State>('checking');
  const [model, setModel] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.HEALTH);
        if (!response.ok) throw new Error('bad status');
        const body = await response.json();
        if (cancelled) return;
        setModel(body.model || '');
        if (body.database !== 'ok') setState('no-db');
        else setState(body.claude_configured ? 'online' : 'no-key');
      } catch {
        if (!cancelled) setState('offline');
      }
    };

    check();
    const timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const copy = COPY[state];

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5"
      title={
        state === 'no-key'
          ? 'The server is running but ANTHROPIC_API_KEY is not set — add it to server/.env'
          : state === 'no-db'
            ? 'The API cannot reach Postgres — check DATABASE_URL and run: alembic upgrade head'
            : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${copy.dot} ${state === 'checking' ? 'animate-needle-pulse' : ''}`}
      />
      <span className={`font-mono text-[0.65rem] uppercase tracking-wider ${copy.text}`}>
        {copy.label}
      </span>
      {state === 'online' && model && (
        <span className="hidden font-mono text-[0.65rem] text-faint sm:inline">· {model}</span>
      )}
    </div>
  );
}
