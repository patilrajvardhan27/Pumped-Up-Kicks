'use client';

import { useEffect, useState } from 'react';
import { chatService } from '@/services/chatService';
import type { UsageSummary } from '@/types/api';

/** This account's spend for the month. Refetches whenever the trigger changes. */
export function useUsage(refreshTrigger?: number): UsageSummary | null {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    chatService
      .getUsage()
      .then((result) => {
        if (!cancelled) setUsage(result);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return usage;
}
