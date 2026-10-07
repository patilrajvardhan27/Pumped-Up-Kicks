'use client';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { useServerStatus } from '@/hooks/useServerStatus';
import type { ServerState } from '@/hooks/useServerStatus';

/*
 * Setup hints name environment variables, so they exist on the developer's machine
 * only. The condition sits at each string so the bundler drops them from production.
 */
const COPY: Record<ServerState, { label: string; dot: string; hint?: string }> = {
  checking: { label: 'Connecting', dot: 'bg-mute animate-pulse-dot' },
  online: { label: 'Live', dot: 'bg-accent-green' },
  'no-key': {
    label: 'No API key',
    dot: 'bg-primary-active',
    hint:
      process.env.NODE_ENV !== 'production'
        ? 'The server is running but ANTHROPIC_API_KEY is not set. Add it to server/.env'
        : undefined,
  },
  'no-db': {
    label: 'No database',
    dot: 'bg-accent-red',
    hint:
      process.env.NODE_ENV !== 'production'
        ? 'The API cannot reach Postgres. Check DATABASE_URL and run: alembic upgrade head'
        : undefined,
  },
  offline: { label: 'Server offline', dot: 'bg-accent-red' },
};

/** Live API health. The dot carries real state; the label says the same in words. */
export function ServerStatus({ compact = false }: { compact?: boolean }) {
  const { state, model } = useServerStatus();
  const copy = COPY[state];

  return (
    <Badge role="status" title={copy.hint}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', copy.dot)} />
      {/* Phones get the dot alone; the label stays available to screen readers. */}
      <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{copy.label}</span>
      {state === 'online' && model && (
        <span className="hidden font-mono text-code-xs text-mute-strong md:inline">{model}</span>
      )}
    </Badge>
  );
}
