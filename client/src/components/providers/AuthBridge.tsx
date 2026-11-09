'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect } from 'react';
import { useIdleSignOut } from '@/hooks/useIdleSignOut';
import { setTokenGetter } from '@/lib/authToken';

/**
 * Publishes Clerk's session token to the API client, which is plain fetch and
 * has no access to React context, and ends sessions left idle.
 */
export function AuthBridge() {
  const { getToken, isLoaded, isSignedIn, signOut } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken, isLoaded]);

  const endIdleSession = useCallback(() => signOut({ redirectUrl: '/?signed-out=idle' }), [signOut]);
  useIdleSignOut(Boolean(isSignedIn), endIdleSession);

  return null;
}
