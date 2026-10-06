'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { authEnabled, CLERK_PUBLISHABLE_KEY } from '@/lib/clerk';
import { AnalyticsIdentity } from '@/components/consent/AnalyticsIdentity';
import { AuthBridge } from './AuthBridge';

/**
 * Wraps the app in Clerk only when a publishable key is configured. Without
 * one the app still runs: the API is in dev auth mode and treats every request
 * as the same local user.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  if (!authEnabled) return <>{children}</>;

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AuthBridge />
      <AnalyticsIdentity />
      {children}
    </ClerkProvider>
  );
}
