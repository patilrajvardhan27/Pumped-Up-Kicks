'use client';

import { useEffect, useState } from 'react';
import { chatService } from '@/services';
import type { UsageSummary } from '@/types/api';

/**
 * This account's Claude spend for the month, against its plan limit. Shown so
 * cost is a visible number rather than something discovered on a bill.
 */
export default function UsageMeter({ refreshTrigger }: { refreshTrigger?: number }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    chatService.getUsage().then(setUsage).catch(() => setUsage(null));
  }, [refreshTrigger]);

  if (!usage || usage.questions_asked === 0) return null;

  const { quota } = usage;
  const cacheRate = Math.round((usage.cache_hits / usage.questions_asked) * 100);

  const barColor = quota.percent_used >= 90
    ? 'bg-fault'
    : quota.percent_used >= 70
      ? 'bg-signal'
      : 'bg-live';

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-baseline justify-between font-mono text-[0.65rem]">
        <span className="uppercase tracking-wider text-faint">
          This month · {quota.plan}
        </span>
        <span className={quota.exhausted ? 'text-fault' : 'text-muted'}>
          ${quota.spent_usd.toFixed(4)} / ${quota.limit_usd.toFixed(2)}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-well">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(2, quota.percent_used)}%` }}
          role="progressbar"
          aria-valuenow={quota.percent_used}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Monthly spend used"
        />
      </div>

      <dl className="flex items-center justify-between font-mono text-[0.65rem]">
        <div>
          <dt className="uppercase tracking-wider text-faint">Questions</dt>
          <dd className="mt-0.5 text-sm text-ink">{usage.questions_asked}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-faint">From cache</dt>
          <dd className="mt-0.5 text-sm text-live">{cacheRate}%</dd>
        </div>
        <div className="text-right">
          <dt className="uppercase tracking-wider text-faint">Left</dt>
          <dd className="mt-0.5 text-sm text-signal">${quota.remaining_usd.toFixed(2)}</dd>
        </div>
      </dl>
    </section>
  );
}
