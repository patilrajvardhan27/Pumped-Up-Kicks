'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PanelTab<K extends string> {
  key: K;
  label: string;
}

interface PanelTabsProps<K extends string> {
  tabs: PanelTab<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
  children: ReactNode;
}

/**
 * Pill tabs over one panel, following the WAI-ARIA tabs pattern: arrow keys
 * move between tabs, Home and End jump to the ends.
 */
export function PanelTabs<K extends string>({ tabs, active, onChange, label, children }: PanelTabsProps<K>) {
  const id = useId();
  const refs = useRef(new Map<K, HTMLButtonElement>());

  const move = (event: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    onChange(tabs[target].key);
    refs.current.get(tabs[target].key)?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {tabs.length > 1 && (
        <div role="tablist" aria-label={label} className="flex shrink-0 flex-wrap gap-1">
          {tabs.map((tab, index) => {
            const selected = tab.key === active;
            return (
              <button
                key={tab.key}
                ref={(element) => {
                  if (element) refs.current.set(tab.key, element);
                  else refs.current.delete(tab.key);
                }}
                type="button"
                role="tab"
                id={`${id}-${tab.key}`}
                aria-selected={selected}
                aria-controls={`${id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => onChange(tab.key)}
                onKeyDown={(event) => move(event, index)}
                className={cn(
                  'min-h-9 rounded-full px-3.5 text-button-sm',
                  selected ? 'bg-ink text-on-dark focus-on-dark' : 'text-body hover:bg-surface-soft',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
      <div
        role={tabs.length > 1 ? 'tabpanel' : undefined}
        id={`${id}-panel`}
        aria-labelledby={tabs.length > 1 ? `${id}-${active}` : undefined}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </div>
    </div>
  );
}
