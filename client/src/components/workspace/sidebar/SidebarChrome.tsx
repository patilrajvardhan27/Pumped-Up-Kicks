import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { CloseIcon, PlusIcon, SidebarIcon } from '@/components/ui/icons';
import type { CanvasStatus } from '@/types/api';
import { CanvasEntry } from '../canvas/CanvasEntry';

interface SidebarHeaderProps {
  modifier: string;
  onNew: () => void;
  /** Desktop: collapse to the rail. */
  onToggleCollapsed?: () => void;
  /** Drawer: close it. */
  onClose?: () => void;
}

/** The sidebar's title bar: Subjects, then new, collapse and close. */
export function SidebarHeader({ modifier, onNew, onToggleCollapsed, onClose }: SidebarHeaderProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-pebble pr-2 pl-4">
      <h2 className="text-label text-ink-navy">Subjects</h2>
      <div className="flex items-center">
        <IconButton aria-label="New subject" onClick={onNew}>
          <PlusIcon />
        </IconButton>
        {onToggleCollapsed && (
          <IconButton
            aria-label="Hide the subject list"
            aria-keyshortcuts="Control+\ Meta+\"
            title={`Hide (${modifier} \\)`}
            onClick={onToggleCollapsed}
          >
            <SidebarIcon />
          </IconButton>
        )}
        {onClose && (
          <IconButton aria-label="Close the subject list" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md bg-pebble px-1 tabular-nums text-caption text-ink-navy">{children}</kbd>;
}

interface SidebarFooterProps {
  modifier: string;
  /** Only on desktop, where the shortcuts work. */
  showShortcuts: boolean;
  canvasStatus: CanvasStatus | null;
  onOpenCanvas: () => void;
}

/** Below the subject list: the Canvas entry and, on desktop, the keyboard shortcuts. */
export function SidebarFooter({ modifier, showShortcuts, canvasStatus, onOpenCanvas }: SidebarFooterProps) {
  return (
    <>
      <div className="shrink-0 border-t border-pebble p-2">
        <CanvasEntry status={canvasStatus} onOpen={onOpenCanvas} />
      </div>
      {showShortcuts && (
        <p className="shrink-0 border-t border-pebble px-4 py-3 text-caption text-slate-gray">
          <Kbd>{modifier}</Kbd> <Kbd>1</Kbd> to <Kbd>9</Kbd> opens a subject. <Kbd>{modifier}</Kbd> <Kbd>\</Kbd> hides
          this list.
        </p>
      )}
    </>
  );
}
