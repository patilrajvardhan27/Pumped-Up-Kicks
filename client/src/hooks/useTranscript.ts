'use client';

import { useEffect, useState } from 'react';
import { videoService } from '@/services/videoService';
import type { TranscriptLine } from '@/types/api';

type State =
  | { status: 'loading'; lines: TranscriptLine[] }
  | { status: 'ready'; lines: TranscriptLine[] }
  | { status: 'error'; lines: TranscriptLine[]; message: string };

/** Loads one lecture's transcript. Mount it keyed by lecture id so each starts loading. */
export function useTranscript(videoId: number): State {
  const [state, setState] = useState<State>({ status: 'loading', lines: [] });

  useEffect(() => {
    let cancelled = false;

    videoService
      .getTranscript(videoId)
      .then((transcript) => {
        if (!cancelled) setState({ status: 'ready', lines: transcript.lines });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Could not load the transcript.';
          setState({ status: 'error', lines: [], message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return state;
}
