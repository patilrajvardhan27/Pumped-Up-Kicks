'use client';

import { useEffect } from 'react';
import { disableAnalytics, enableAnalytics, track } from '@/lib/analytics';
import { useConsent } from '@/lib/consent';

/**
 * Turns analytics on and off to match the visitor's recorded choice, and
 * reports clicks on anything marked data-track (one listener, no per-button code).
 */
export function AnalyticsProvider() {
  const consent = useConsent();

  useEffect(() => {
    if (consent === 'pending') return;
    if (consent === 'granted') void enableAnalytics();
    else disableAnalytics();
  }, [consent]);

  useEffect(() => {
    if (consent !== 'granted') return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track]') : null;
      if (target?.dataset.track) track('cta_clicked', { id: target.dataset.track });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [consent]);

  return null;
}
