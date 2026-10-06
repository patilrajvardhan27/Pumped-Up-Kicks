import type { Source, Usage } from './api';

/** One question and its answer, as shown in the chat pane. */
export interface Turn {
  key: string;
  question: string;
  answer: string;
  sources: Source[];
  usage?: Usage;
  responseTime?: number;
  costUsd?: number | null;
  streaming: boolean;
  error?: string;
}

/** Jumps the player to a moment in a lecture. */
export type SeekHandler = (videoId: number, seconds: number) => void;
