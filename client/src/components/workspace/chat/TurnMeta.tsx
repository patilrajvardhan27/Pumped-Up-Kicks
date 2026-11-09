import { formatUsd } from '@/lib/format';
import type { Turn } from '@/types/chat';

/** Time, tokens and cost for one answer, so spend is visible where it happens. */
export function TurnMeta({ turn }: { turn: Turn }) {
  if (turn.streaming || (!turn.usage && turn.costUsd == null)) return null;

  const cost = turn.usage?.cost_usd ?? turn.costUsd ?? 0;

  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code-xs tabular-nums text-mute-strong">
      {turn.responseTime != null && <span>{turn.responseTime.toFixed(1)}s</span>}
      {turn.usage && (
        <span>
          {turn.usage.input_tokens} in / {turn.usage.output_tokens} out
        </span>
      )}
      <span>{formatUsd(cost, 5)}</span>
      {turn.usage?.model && <span>{turn.usage.model}</span>}
    </p>
  );
}
