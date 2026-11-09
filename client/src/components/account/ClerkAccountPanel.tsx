'use client';

import { useClerk } from '@clerk/nextjs';
import { useCallback } from 'react';
import { AccountPanel } from './AccountPanel';

/** With Clerk on, deleting the account also removes the sign-in and ends the session. */
export function ClerkAccountPanel() {
  const { user, signOut } = useClerk();

  const afterDelete = useCallback(async () => {
    try {
      await user?.delete();
    } finally {
      await signOut({ redirectUrl: '/?account=deleted' });
    }
  }, [user, signOut]);

  return <AccountPanel afterDelete={afterDelete} />;
}
