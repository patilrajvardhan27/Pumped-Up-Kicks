'use client';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { Card } from '@/components/ui/Card';
import { useUsage } from '@/hooks/useUsage';
import { formatUsd, pluralise } from '@/lib/format';

/**
 * The monthly allowance in plain terms: how much is used and when it resets.
 * The exact dollar figures stay one hover away for anyone who wants them.
 */
export function UsageMeter({ refreshTrigger }: { refreshTrigger?: number }) {
  const usage = useUsage(refreshTrigger);

  if (!usage || usage.questions_asked === 0) return null;

  const { quota } = usage;
  const tone = quota.percent_used >= 90 ? 'danger' : quota.percent_used >= 70 ? 'primary' : 'success';
  const status = quota.exhausted
    ? 'Allowance used up. It resets on the 1st.'
    : `${100 - quota.percent_used}% left this month. Resets on the 1st.`;

  return (
    <Card as="section" padding="tile" aria-labelledby="usage-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="usage-heading" className="eyebrow">
          Monthly allowance
        </h2>
        <span
          className="text-caption-sm text-mute-strong"
          title={`${formatUsd(quota.spent_usd, 4)} of ${formatUsd(quota.limit_usd)} on the ${quota.plan} plan`}
        >
          {pluralise(usage.questions_asked, 'answer')}
        </span>
      </div>

      <ProgressBar value={Math.max(2, quota.percent_used)} label="Monthly allowance used" tone={tone} />

      <p className={`text-caption-sm ${quota.exhausted ? 'text-danger' : 'text-body'}`}>{status}</p>
      {usage.cache_hits > 0 && (
        <p className="text-caption-sm text-mute-strong">
          {pluralise(usage.cache_hits, 'repeat answer')} served free from your history.
        </p>
      )}
    </Card>
  );
}
