'use client';

import { track } from '@/lib/analytics';
import { cn } from '@/lib/cn';

export type PanelView = 'chat' | 'transcript';

const TABS: { id: PanelView; label: string }[] = [
  { id: 'chat', label: 'Ask & study' },
  { id: 'transcript', label: 'Transcript' },
];

/** Switches the main pane between the chat and the selected lecture's transcript. */
export function PanelTabs({ view, onChange }: { view: PanelView; onChange: (view: PanelView) => void }) {
  return (
    <div role="tablist" aria-label="Lecture view" className="flex gap-1 border-b border-hairline-soft">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          onClick={() => {
            if (tab.id === 'transcript') track('transcript_opened', {});
            onChange(tab.id);
          }}
          className={cn(
            '-mb-px min-h-9 border-b-2 px-3 text-button-sm',
            view === tab.id ? 'border-ink text-ink' : 'border-transparent text-mute-strong hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
