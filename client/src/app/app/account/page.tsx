import type { Metadata } from 'next';
import { AccountView } from '@/components/account/AccountView';
import { Desktop } from '@/components/shell/Desktop';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';

export const metadata: Metadata = {
  title: 'Your data',
  robots: { index: false, follow: false },
};

/** Export or delete your data, without having to email anyone. */
export default function AccountPage() {
  return (
    <Desktop>
      <WorkspaceHeader />
      <main id="main" className="page mx-auto flex w-full max-w-3xl flex-col gap-4 pt-2 pb-8">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">Account</p>
          <h1 className="text-display-md text-ink">Your data</h1>
        </header>
        <AccountView />
      </main>
    </Desktop>
  );
}
