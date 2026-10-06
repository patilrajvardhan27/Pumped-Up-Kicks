'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { identify, resetIdentity } from '@/lib/analytics';
import { useConsent } from '@/lib/consent';

/**
 * Ties analytics to the signed-in account by its opaque id. No email or name is
 * sent. Rendered inside ClerkProvider only, so dev mode never calls useAuth.
 */
export function AnalyticsIdentity() {
  const { userId, isLoaded } = useAuth();
  const consent = useConsent();

  useEffect(() => {
    if (!isLoaded || consent !== 'granted') return;
    if (userId) identify(userId);
    else resetIdentity();
  }, [userId, isLoaded, consent]);

  return null;
}
