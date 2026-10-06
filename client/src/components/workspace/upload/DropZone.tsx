'use client';

import { useState } from 'react';
import type { Ref } from 'react';
import { UploadIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';

interface DropZoneProps {
  inputRef: Ref<HTMLInputElement>;
  file: File | null;
  accept: string[];
  disabled: boolean;
  onFile: (file: File) => void;
}

/**
 * A real file input stretched over a dashed target, so click, keyboard and
 * drag-and-drop all go through the browser's own control.
 */
export function DropZone({ inputRef, file, accept, disabled, onFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const dropped = event.dataTransfer.files?.[0];
        if (dropped && !disabled) onFile(dropped);
      }}
      className={cn(
        'relative flex min-h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed px-4 py-6 text-center',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-blue',
        dragging ? 'border-ink bg-surface-soft' : 'border-hairline-strong bg-surface-doc',
        disabled ? 'opacity-60' : 'hover:border-ink',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        aria-label="Choose a video file, or drop one here"
        disabled={disabled}
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onFile(chosen);
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />

      {file ? (
        <>
          <p className="max-w-full truncate text-body-sm-strong text-ink">{file.name}</p>
          <p className="font-mono text-code-xs tabular-nums text-mute-strong">
            {formatBytes(file.size, 1)}
          </p>
        </>
      ) : (
        <>
          <UploadIcon className="mb-1 size-5 text-mute-strong" />
          <p className="text-body-xs text-ink">Drop a recording here, or click to choose one</p>
          <p className="text-caption-sm text-mute-strong">Up to 4&nbsp;GB</p>
        </>
      )}
    </div>
  );
}
