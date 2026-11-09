'use client';

import { track } from '@/lib/analytics';
import { downloadNotes } from '@/lib/exportNotes';
import type { Turn } from '@/types/chat';

/** Saves the chat as Markdown, citations included, for Notion, Obsidian or a revision doc. */
export function ExportNotesButton({ turns, title, disabled }: { turns: Turn[]; title: string; disabled: boolean }) {
  if (turns.length === 0) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        track('notes_exported', {});
        downloadNotes(`Notes: ${title}`, turns);
      }}
      className="self-end rounded-sm text-caption-sm text-body underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
    >
      Download notes (.md)
    </button>
  );
}
