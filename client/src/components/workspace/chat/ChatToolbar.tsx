'use client';

import { track } from '@/lib/analytics';
import { downloadNotes } from '@/lib/exportNotes';
import { STUDY_TOOLS } from '@/lib/studyTools';
import type { ChatMode } from '@/types/api';
import type { Turn } from '@/types/chat';

interface ChatToolbarProps {
  turns: Turn[];
  /** Study tools need one lecture; they are hidden when the chat spans all of them. */
  scoped: boolean;
  scopeLabel: string;
  busy: boolean;
  onAsk: (question: string, mode?: ChatMode) => void;
}

const CHIP =
  'min-h-8 rounded-full border border-hairline px-3 text-caption-sm text-ink hover:border-ink disabled:opacity-50';

/** Study tools and export, kept within reach once a conversation is under way. */
export function ChatToolbar({ turns, scoped, scopeLabel, busy, onAsk }: ChatToolbarProps) {
  if (turns.length === 0) return null;

  const exportNotes = () => {
    track('notes_exported', {});
    downloadNotes(`Notes: ${scopeLabel}`, turns);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scoped &&
        STUDY_TOOLS.map((tool) => (
          <button
            key={tool.mode}
            type="button"
            disabled={busy}
            onClick={() => onAsk(tool.label, tool.mode)}
            className={CHIP}
          >
            {tool.short}
          </button>
        ))}
      <button type="button" disabled={busy} onClick={exportNotes} className={`${CHIP} ml-auto`}>
        Download notes (.md)
      </button>
    </div>
  );
}
