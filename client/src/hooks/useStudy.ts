'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/services/api';
import { studyService } from '@/services/studyService';
import type { Deadline, PracticeKind, PracticeSet, StudyGuide } from '@/types/api';

const messageOf = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback;

/**
 * One lecture's study guide. Mount it per lecture (keyed by video id) so a
 * new lecture starts clean.
 */
export function useStudyGuide(videoId: number) {
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studyService
      .guide(videoId)
      .then((found) => {
        if (!cancelled) setGuide(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Could not load the study guide.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const make = useCallback(async () => {
    setMaking(true);
    setError(null);
    try {
      setGuide(await studyService.makeGuide(videoId));
    } catch (err) {
      setError(messageOf(err, 'Could not make the study guide. Try again.'));
    } finally {
      setMaking(false);
    }
  }, [videoId]);

  return { guide, loading, making, error, make };
}

/** A subject's practice sets, newest first. Mount it per subject. */
export function usePractice(workspaceId: number) {
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    studyService
      .practiceSets(workspaceId)
      .then((items) => {
        if (!cancelled) setSets(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(messageOf(err, 'Could not load your practice sets.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const make = useCallback(
    async (kind: PracticeKind, count: number, focus: string) => {
      setMaking(true);
      setError(null);
      try {
        const made = await studyService.makePractice(workspaceId, {
          kind,
          count,
          ...(focus.trim() ? { focus: focus.trim() } : {}),
        });
        setSets((prev) => [made, ...prev]);
        return true;
      } catch (err) {
        setError(messageOf(err, 'Could not make the practice set. Try again.'));
        return false;
      } finally {
        setMaking(false);
      }
    },
    [workspaceId],
  );

  const remove = useCallback(async (id: number) => {
    try {
      await studyService.deletePractice(id);
      setSets((prev) => prev.filter((set) => set.id !== id));
    } catch (err) {
      setError(messageOf(err, 'Could not delete that set.'));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { sets, loading, making, error, clearError, make, remove };
}

/** Upcoming Canvas deadlines for every subject. Reloads when the trigger changes. */
export function useDeadlines(refreshTrigger?: number) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    let cancelled = false;
    studyService
      .deadlines()
      .then((items) => {
        if (!cancelled) setDeadlines(items);
      })
      .catch(() => {
        if (!cancelled) setDeadlines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return deadlines;
}
