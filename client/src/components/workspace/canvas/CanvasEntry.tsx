import { IconButton } from '@/components/ui/IconButton';
import { CanvasIcon } from '@/components/ui/icons';
import { formatRelativeTime } from '@/lib/format';
import type { CanvasStatus } from '@/types/api';

/** One line of Canvas status for the sidebar. */
export function canvasSummary(status: CanvasStatus | null): string {
  if (!status) return '';
  if (!status.connected) return 'Not connected';
  const sync = status.sync;
  if (sync?.stage === 'queued') return 'Starting sync';
  if (sync?.stage === 'syncing') return `Syncing, ${sync.progress}%`;
  if (sync?.stage === 'failed') return 'Last sync failed';
  if (sync?.stage === 'ready' && sync.finished_at) return `Synced ${formatRelativeTime(sync.finished_at)}`;
  return 'Connected';
}

interface CanvasEntryProps {
  status: CanvasStatus | null;
  onOpen: () => void;
  compact?: boolean;
}

/** The sidebar's way into the Canvas dialog: a row, or a tile in the collapsed rail. */
export function CanvasEntry({ status, onOpen, compact = false }: CanvasEntryProps) {
  const summary = canvasSummary(status);

  if (compact) {
    return (
      <IconButton aria-label={`Canvas: ${summary || 'open'}`} title={`Canvas: ${summary}`} onClick={onOpen} className="size-10">
        <CanvasIcon className="size-5" />
      </IconButton>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-surface-soft"
    >
      <CanvasIcon className="size-5 text-ink" />
      <span className="text-body-xs text-ink">Canvas</span>
      <span
        className={`ml-auto truncate text-caption-sm ${status?.sync?.stage === 'failed' ? 'text-danger' : 'text-mute-strong'}`}
      >
        {summary}
      </span>
    </button>
  );
}
