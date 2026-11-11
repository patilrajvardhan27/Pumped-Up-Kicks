'use client';

import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { SkeletonLines } from '@/components/ui/Skeleton';
import { CANVAS_ERROR_TEXT } from '@/lib/canvasReturn';
import type { WorkspaceInfo } from '@/types/api';
import { CanvasConnect, type Canvas } from './CanvasConnect';
import { CanvasConnected } from './CanvasConnected';

interface CanvasDialogProps {
  open: boolean;
  onClose: () => void;
  canvas: Canvas;
  workspaces: WorkspaceInfo[];
  /** Hide the result of a Canvas sign-in once the dialog has been closed. */
  hideOutcome: boolean;
}

/** Connect Canvas, choose which course feeds which subject, sync, disconnect. */
export function CanvasDialog({ open, onClose, canvas, workspaces, hideOutcome }: CanvasDialogProps) {
  const { status } = canvas;
  const outcome = hideOutcome ? null : canvas.outcome;

  return (
    <Dialog open={open} onClose={onClose} title="Canvas">
      <div className="flex flex-col gap-5">
        {outcome?.kind === 'finishing' && (
          <Alert tone="info" title="Finishing the Canvas sign-in">
            This takes a moment.
          </Alert>
        )}
        {outcome?.kind === 'connected' && (
          <Alert tone="success" title="Canvas connected">
            Choose which courses to import, then sync.
          </Alert>
        )}
        {outcome && (outcome.kind === 'denied' || outcome.kind === 'invalid' || outcome.kind === 'failed') && (
          <Alert tone={CANVAS_ERROR_TEXT[outcome.kind].tone} title={CANVAS_ERROR_TEXT[outcome.kind].title}>
            {CANVAS_ERROR_TEXT[outcome.kind].text}
          </Alert>
        )}
        {canvas.error && (
          <Alert tone="danger" onClose={canvas.clearError}>
            {canvas.error}
          </Alert>
        )}

        {status === null ? (
          <SkeletonLines label="Loading Canvas" lines={3} />
        ) : status.connected ? (
          <CanvasConnected status={status} canvas={canvas} workspaces={workspaces} open={open} />
        ) : (
          <CanvasConnect status={status} canvas={canvas} />
        )}
      </div>
    </Dialog>
  );
}
