'use client';

import { Button } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { CookieIcon } from '@/components/ui/icons';
import { analyticsConfigured } from '@/lib/analytics';
import { useConsent, writeConsent } from '@/lib/consent';

/**
 * Asks before any analytics run. Sign-in cookies are strictly necessary and
 * need no consent, so with no analytics configured there is nothing to ask and
 * the banner never appears. Accept and Decline carry equal weight on purpose.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const open = analyticsConfigured && consent === 'unset';

  if (!open) return null;

  return (
        <section
          aria-label="Analytics consent"
          className="panel fixed inset-x-3 bottom-3 z-(--z-banner) flex animate-rise flex-col gap-4 p-6 shadow-elevated sm:right-auto sm:bottom-6 sm:left-6 sm:w-banner"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-pebble text-ink-navy">
              <CookieIcon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-body-strong text-ink-navy">Count visits with PostHog?</h2>
              <p className="text-body-sm text-slate-gray">
                Sign-in cookies are always on. With your OK we also measure which features get used.
                Lecture and chat content is never sent, and screen recording is off.{' '}
                <TextLink href="/privacy#cookies">
                  Details
                </TextLink>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" block onClick={() => writeConsent('denied')}>
              Decline
            </Button>
            <Button variant="secondary" size="sm" block onClick={() => writeConsent('granted')}>
              Accept
            </Button>
          </div>
        </section>
  );
}

/** Lets a visitor change their mind. Clearing the choice pauses analytics until they answer. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  if (!analyticsConfigured) return null;
  return (
    <button type="button" onClick={() => writeConsent('unset')} className={className}>
      Cookie settings
    </button>
  );
}
