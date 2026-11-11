'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { useUsage } from '@/hooks/useUsage';
import { formatUsd } from '@/lib/format';

/**
 * This account's Claude spend for the month, against its plan limit. Shown so
 * cost is a visible number rather than something discovered on a bill.
 */
export function UsageMeter({ refreshTrigger }: { refreshTrigger?: number }) {
  const usage = useUsage(refreshTrigger);

  if (!usage || (usage.questions_asked === 0 && !usage.content?.used_chunks)) return null;

  const { quota, content } = usage;
  const cacheRate = usage.questions_asked ? Math.round((usage.cache_hits / usage.questions_asked) * 100) : 0;
  const tone = quota.percent_used >= 90 ? 'danger' : quota.percent_used >= 70 ? 'primary' : 'success';

  return (
    <Card as="section" padding="tile" aria-labelledby="usage-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="usage-heading" className="text-button-sm text-ink-navy">
          This month, {quota.plan} plan
        </h2>
        <span
          className={`tabular-nums text-caption ${quota.exhausted ? 'text-danger' : 'text-slate-gray'}`}
        >
          {formatUsd(quota.spent_usd, 4)} / {formatUsd(quota.limit_usd)}
        </span>
      </div>

      <ProgressBar value={Math.max(2, quota.percent_used)} label="Monthly spend used" tone={tone} />

      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-caption text-slate-gray">Questions</dt>
          <dd className="tabular-nums text-body-sm text-ink-navy">{usage.questions_asked}</dd>
        </div>
        <div>
          <dt className="text-caption text-slate-gray">From cache</dt>
          <dd className="tabular-nums text-body-sm text-ink-navy">{cacheRate}%</dd>
        </div>
        <div className="text-right">
          <dt className="text-caption text-slate-gray">Left</dt>
          <dd className="tabular-nums text-body-sm text-ink-navy">
            {formatUsd(quota.remaining_usd)}
          </dd>
        </div>
      </dl>

      {content && (
        <p className="flex items-baseline justify-between gap-3 border-t border-pebble pt-3 text-caption text-slate-gray">
          <span>Indexed passages, lectures and course material</span>
          <span className={`tabular-nums text-caption ${content.remaining_chunks === 0 ? 'text-danger' : 'text-slate-gray'}`}>
            {content.used_chunks.toLocaleString('en-US')} / {content.limit_chunks.toLocaleString('en-US')}
          </span>
        </p>
      )}
    </Card>
  );
}
