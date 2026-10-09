'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/services/api';
import { workspaceService } from '@/services/workspaceService';
import type { WorkspaceDraft, WorkspaceInfo } from '@/types/api';

const messageOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/** The user's subjects, in sidebar order, and the changes that can be made to them. */
export function useWorkspaces(refreshTrigger?: number) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    workspaceService
      .list()
      .then((items) => {
        if (cancelled) return;
        setWorkspaces(items);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Could not load your subjects.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  /** Resolves to the new subject, or null when it could not be created. */
  const create = useCallback(async (draft: WorkspaceDraft): Promise<WorkspaceInfo | null> => {
    try {
      const created = await workspaceService.create(draft);
      setWorkspaces((prev) => [...prev, created]);
      setError(null);
      return created;
    } catch (err) {
      setError(messageOf(err, 'Could not create that subject.'));
      return null;
    }
  }, []);

  const update = useCallback(async (id: number, change: Partial<WorkspaceDraft>): Promise<boolean> => {
    try {
      const updated = await workspaceService.update(id, change);
      setWorkspaces((prev) => prev.map((workspace) => (workspace.id === id ? updated : workspace)));
      setError(null);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Could not save that change.'));
      return false;
    }
  }, []);

  const remove = useCallback(async (id: number): Promise<boolean> => {
    try {
      await workspaceService.remove(id);
      setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== id));
      setError(null);
      return true;
    } catch (err) {
      setError(messageOf(err, 'Could not delete that subject.'));
      return false;
    }
  }, []);

  /** Shows the new order at once, and puts the old one back if the server refuses it. */
  const reorder = useCallback(
    async (ids: number[]) => {
      const previous = workspaces;
      const byId = new Map(previous.map((workspace) => [workspace.id, workspace]));
      setWorkspaces(ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as WorkspaceInfo] : [])));
      try {
        setWorkspaces(await workspaceService.reorder(ids));
        setError(null);
      } catch (err) {
        setWorkspaces(previous);
        setError(messageOf(err, 'Could not save the new order.'));
      }
    },
    [workspaces],
  );

  const clearError = useCallback(() => setError(null), []);

  return { workspaces, loading, error, clearError, reload, create, update, remove, reorder };
}
