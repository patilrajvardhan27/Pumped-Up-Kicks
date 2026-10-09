import type { DragEvent } from 'react';

/*
 * Drag and drop between the library and the sidebar. Custom MIME types keep a
 * dragged lecture from being mistaken for a dragged subject (or for a file
 * dropped from the desktop). During dragover only the types are readable, not
 * the data, which is all a drop target needs to decide whether to light up.
 *
 * Mouse only: every drag here has a keyboard and touch equivalent (the
 * "Subject" menu on each lecture, and Move up / Move down on each subject).
 */
export const VIDEO_DRAG = 'application/x-puk-video';
export const WORKSPACE_DRAG = 'application/x-puk-workspace';

type DragKind = typeof VIDEO_DRAG | typeof WORKSPACE_DRAG;

export function startDrag(event: DragEvent, kind: DragKind, id: number, label: string): void {
  event.dataTransfer.setData(kind, String(id));
  event.dataTransfer.setData('text/plain', label);
  event.dataTransfer.effectAllowed = 'move';
}

export function carries(event: DragEvent, kind: DragKind): boolean {
  return Array.from(event.dataTransfer.types).includes(kind);
}

export function draggedId(event: DragEvent, kind: DragKind): number | null {
  const id = Number(event.dataTransfer.getData(kind));
  return Number.isInteger(id) && id > 0 ? id : null;
}
