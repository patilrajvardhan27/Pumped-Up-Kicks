'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { authEnabled, CLERK_PUBLISHABLE_KEY } from '@/lib/clerk';
import AuthBridge from './AuthBridge';

/**
 * Wraps the app in Clerk only when a publishable key is configured. Without
 * one the app still runs: the API is in dev auth mode and treats every request
 * as the same local user.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  if (!authEnabled) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{ variables: { colorPrimary: '#F2A03D', borderRadius: '0.5rem' } }}
    >
      <AuthBridge />
      {children}
    </ClerkProvider>
  );
}
