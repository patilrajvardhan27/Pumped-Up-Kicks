'use client';

import { useEffect, useState } from 'react';
import { canvasService } from '@/services/canvasService';
import type { DocumentInfo } from '@/types/api';

/** Imported course material in one subject (or in none). Reloads when the trigger changes. */
export function useDocuments(filter: { workspaceId?: number | null; unsorted?: boolean; all?: boolean }, refreshTrigger?: number) {
  const { workspaceId, unsorted, all } = filter;
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    canvasService
      .documents(all ? {} : { workspaceId, unsorted })
      .then((items) => {
        if (!cancelled) setDocuments(items);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, unsorted, all, refreshTrigger]);

  return documents;
}
