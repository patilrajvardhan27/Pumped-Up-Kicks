import { formatUsd } from '@/lib/format';
import type { Turn } from '@/types/chat';

/** How long the answer took and what it cost, kept small and out of the way. */
export function TurnMeta({ turn }: { turn: Turn }) {
  if (turn.streaming || (!turn.usage && turn.costUsd == null)) return null;

  const cost = turn.usage?.cost_usd ?? turn.costUsd ?? 0;

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code-xs tabular-nums text-mute-strong">
      {turn.responseTime != null && <span>{turn.responseTime.toFixed(1)}s</span>}
      <span>{cost === 0 ? 'free (from history)' : formatUsd(cost, 4)}</span>
    </p>
  );
}
