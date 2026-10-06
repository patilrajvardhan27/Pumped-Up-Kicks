'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { setTokenGetter } from '@/lib/authToken';

/**
 * Publishes Clerk's session token to the API client, which is plain fetch and
 * has no access to React context.
 */
export default function AuthBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken, isLoaded]);

  return null;
}
