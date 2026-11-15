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
  checking: { label: 'Connecting', dot: 'bg-slate-gray animate-pulse-dot' },
  online: { label: 'Live', dot: 'bg-success' },
  'no-db': {
    label: 'No database',
    dot: 'bg-danger',
    hint:
      process.env.NODE_ENV !== 'production'
        ? 'The API cannot reach Postgres. Check DATABASE_URL and run: alembic upgrade head'
        : undefined,
  },
  offline: { label: 'Server offline', dot: 'bg-danger' },
};

/** Live API health. The dot carries real state; the label says the same in words. */
export function ServerStatus({ compact = false }: { compact?: boolean }) {
  const state = useServerStatus();
  const copy = COPY[state];

  return (
    <Badge role="status" title={copy.hint}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', copy.dot)} />
      {/* Phones get the dot alone; the label stays available to screen readers. */}
      <span className={compact ? 'sr-only sm:not-sr-only' : undefined}>{copy.label}</span>
    </Badge>
  );
}
