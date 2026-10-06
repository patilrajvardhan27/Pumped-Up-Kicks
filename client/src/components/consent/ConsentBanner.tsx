'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CookieIcon } from '@/components/ui/icons';
import { analyticsConfigured } from '@/lib/analytics';
import { useConsent, writeConsent } from '@/lib/consent';
import { DURATION } from '@/lib/motion';

/**
 * Asks before any analytics run. Sign-in cookies are strictly necessary and
 * need no consent, so with no analytics configured there is nothing to ask and
 * the banner never appears. Accept and Decline carry equal weight on purpose.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const open = analyticsConfigured && consent === 'unset';

  return (
    <AnimatePresence>
      {open && (
        <m.section
          aria-label="Analytics consent"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: DURATION.base }}
          className="card fixed inset-x-3 bottom-3 z-(--z-banner) flex flex-col gap-3 p-4 shadow-window sm:right-auto sm:bottom-5 sm:left-5 sm:w-[26rem]"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-soft text-ink">
              <CookieIcon className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-body-strong text-ink">Count visits with PostHog?</h2>
              <p className="text-body-xs font-normal text-body">
                Sign-in cookies are always on. With your OK we also measure which features get used.
                Lecture and chat content is never sent, and screen recording is off.{' '}
                <Link href="/privacy#cookies" className="text-link-blue underline">
                  Details
                </Link>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" block onClick={() => writeConsent('denied')}>
              Decline
            </Button>
            <Button variant="secondary" block onClick={() => writeConsent('granted')}>
              Accept
            </Button>
          </div>
        </m.section>
      )}
    </AnimatePresence>
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
