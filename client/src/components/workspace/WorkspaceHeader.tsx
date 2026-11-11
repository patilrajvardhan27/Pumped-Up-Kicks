import { SiteHeader } from '@/components/site/SiteHeader';
import { ServerStatus } from './ServerStatus';
import { UserBar } from './UserBar';

/** The site bar without the marketing menu, carrying the workspace's own controls. */
export function WorkspaceHeader({ title = 'Workspace' }: { title?: string }) {
  return (
    <SiteHeader
      showNav={false}
      actions={
        <>
          <ServerStatus compact />
          <UserBar />
        </>
      }
    >
      <span aria-hidden="true" className="hidden h-6 w-px bg-hairline sm:block" />
      <h1 className="sr-only text-label text-slate-gray sm:not-sr-only">{title}</h1>
    </SiteHeader>
  );
}
