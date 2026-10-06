import { MenuBar } from '@/components/shell/MenuBar';
import { ServerStatus } from './ServerStatus';
import { UserBar } from './UserBar';

export function WorkspaceHeader() {
  return (
    <MenuBar
      actions={
        <>
          <ServerStatus compact />
          <UserBar />
        </>
      }
    >
      <h1 className="eyebrow sr-only sm:not-sr-only">Workspace</h1>
    </MenuBar>
  );
}
