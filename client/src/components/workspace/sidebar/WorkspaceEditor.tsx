'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MoveDownIcon, MoveUpIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { WORKSPACE_COLORS, WORKSPACE_ICONS } from '@/lib/workspaces';
import type { WorkspaceDraft } from '@/types/api';
import { SUBJECT_ICONS } from './WorkspaceGlyph';

const NAME_MAX_CHARS = 60;

interface WorkspaceEditorProps {
  initial: WorkspaceDraft;
  mode: 'create' | 'edit';
  /** Resolves true once saved, which closes the editor. */
  onSave: (draft: WorkspaceDraft) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
  /** Keyboard alternative to dragging a subject up or down the list. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const SWATCH_RING =
  'peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-ink-navy peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-blue';

/** Name, colour and icon for a subject, inline in the sidebar. */
export function WorkspaceEditor({
  initial,
  mode,
  onSave,
  onCancel,
  onDelete,
  onMoveUp,
  onMoveDown,
}: WorkspaceEditorProps) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const trimmed = draft.name.trim();

  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <form
      aria-label={mode === 'create' ? 'New subject' : `Edit ${initial.name}`}
      onKeyDown={cancelOnEscape}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!trimmed || saving) return;
        setSaving(true);
        const saved = await onSave({ ...draft, name: trimmed });
        setSaving(false);
        if (saved) onCancel();
      }}
      className="mx-1 mt-1 mb-2 flex flex-col gap-4 rounded-lg border border-hairline bg-paper p-3"
    >
      <Input
        id={`${id}-name`}
        label="Name"
        value={draft.name}
        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
        placeholder="Organic chemistry"
        maxLength={NAME_MAX_CHARS}
        autoComplete="off"
        autoFocus
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-ink-navy">Colour</legend>
        <div className="grid grid-cols-6 gap-2">
          {WORKSPACE_COLORS.map((option) => (
            <label key={option.key} className="relative">
              <input
                type="radio"
                name={`${id}-color`}
                value={option.key}
                checked={draft.color === option.key}
                onChange={() => setDraft((prev) => ({ ...prev, color: option.key }))}
                className="peer sr-only"
              />
              <span aria-hidden="true" className={cn('block aspect-square w-full cursor-pointer rounded-md', option.tile, SWATCH_RING)} />
              <span className="sr-only">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-ink-navy">Icon</legend>
        <div className="grid grid-cols-6 gap-1.5">
          {WORKSPACE_ICONS.map((option) => {
            const Glyph = SUBJECT_ICONS[option.key];
            return (
              <label key={option.key} className="relative">
                <input
                  type="radio"
                  name={`${id}-icon`}
                  value={option.key}
                  checked={draft.icon === option.key}
                  onChange={() => setDraft((prev) => ({ ...prev, icon: option.key }))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex aspect-square w-full cursor-pointer items-center justify-center rounded-md bg-pebble text-ink-navy',
                    'peer-checked:bg-ink-navy peer-checked:text-paper',
                    'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal-blue',
                  )}
                >
                  <Glyph />
                </span>
                <span className="sr-only">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {(onMoveUp || onMoveDown) && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-slate-gray">Position</span>
          <Button variant="secondary" size="sm" disabled={!onMoveUp} onClick={onMoveUp} aria-label="Move up">
            <MoveUpIcon className="size-3.5" />
          </Button>
          <Button variant="secondary" size="sm" disabled={!onMoveDown} onClick={onMoveDown} aria-label="Move down">
            <MoveDownIcon className="size-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {onDelete ? (
          <Button variant="tertiary" size="sm" onClick={onDelete}>
            Delete subject
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!trimmed || saving}>
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
}
