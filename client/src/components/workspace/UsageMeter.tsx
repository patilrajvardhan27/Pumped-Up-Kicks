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
        <h2 id="usage-heading" className="eyebrow">
          This month, {quota.plan} plan
        </h2>
        <span
          className={`font-mono text-code-xs tabular-nums ${quota.exhausted ? 'text-danger' : 'text-body'}`}
        >
          {formatUsd(quota.spent_usd, 4)} / {formatUsd(quota.limit_usd)}
        </span>
      </div>

      <ProgressBar value={Math.max(2, quota.percent_used)} label="Monthly spend used" tone={tone} />

      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-caption-sm text-mute-strong">Questions</dt>
          <dd className="font-mono text-code-sm tabular-nums text-ink">{usage.questions_asked}</dd>
        </div>
        <div>
          <dt className="text-caption-sm text-mute-strong">From cache</dt>
          <dd className="font-mono text-code-sm tabular-nums text-ink">{cacheRate}%</dd>
        </div>
        <div className="text-right">
          <dt className="text-caption-sm text-mute-strong">Left</dt>
          <dd className="font-mono text-code-sm tabular-nums text-ink">
            {formatUsd(quota.remaining_usd)}
          </dd>
        </div>
      </dl>

      {content && (
        <p className="flex items-baseline justify-between gap-3 border-t border-hairline-soft pt-3 text-caption-sm text-mute-strong">
          <span>Indexed passages, lectures and course material</span>
          <span className={`font-mono text-code-xs tabular-nums ${content.remaining_chunks === 0 ? 'text-danger' : 'text-body'}`}>
            {content.used_chunks.toLocaleString('en-US')} / {content.limit_chunks.toLocaleString('en-US')}
          </span>
        </p>
      )}
    </Card>
  );
}
