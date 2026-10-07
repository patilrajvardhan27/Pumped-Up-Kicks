import type { Metadata } from 'next';
import { Desktop } from '@/components/shell/Desktop';
import { Workspace } from '@/components/workspace/Workspace';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';

export const metadata: Metadata = {
  title: 'Workspace',
  // Behind sign-in, with nothing a search engine could read.
  robots: { index: false, follow: false },
  alternates: { canonical: '/app' },
};

export default function AppPage() {
  return (
    <Desktop>
      <WorkspaceHeader />
      <Workspace />
    </Desktop>
  );
}
