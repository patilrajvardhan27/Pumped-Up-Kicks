'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useIdleSignOut } from '@/hooks/useIdleSignOut';
import { resetIdentity } from '@/lib/analytics';
import { setTokenGetter } from '@/lib/authToken';
import { forgetWorkspaceState } from '@/lib/persisted';

/**
 * Publishes Clerk's session token to the API client, which is plain fetch and
 * has no access to React context. Also ends the session cleanly: idle
 * sign-out, and wiping what this browser kept once the user is signed out.
 */
export function AuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  useIdleSignOut();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setTokenGetter(() => getToken());
      return () => setTokenGetter(null);
    }
    // Signed out or the session is gone: keep nothing of the last user.
    setTokenGetter(null);
    forgetWorkspaceState();
    resetIdentity();
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
