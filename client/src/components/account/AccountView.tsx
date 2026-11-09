'use client';

import { useRouter } from 'next/navigation';
import { authEnabled } from '@/lib/clerk';
import { AccountPanel } from './AccountPanel';
import { ClerkAccountPanel } from './ClerkAccountPanel';

/** Clerk's hooks exist only when sign-in is configured, so pick the panel here. */
export function AccountView() {
  const router = useRouter();
  if (authEnabled) return <ClerkAccountPanel />;
  return <AccountPanel afterDelete={async () => router.push('/app')} />;
}
