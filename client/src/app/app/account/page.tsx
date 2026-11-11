import type { Metadata } from 'next';
import { AccountView } from '@/components/account/AccountView';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';

export const metadata: Metadata = {
  title: 'Your data',
  robots: { index: false, follow: false },
};

/** Export or delete your data, without having to email anyone. */
export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <WorkspaceHeader title="Account" />
      <main id="main" className="page section-y">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-3">
            <p className="text-caption-strong tracking-wide text-slate-gray uppercase">Account</p>
            <h1 className="text-heading-sm text-ink-navy">Your data</h1>
          </header>
          <AccountView />
        </div>
      </main>
    </div>
  );
}
