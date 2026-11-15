import type { ChatRequest, Source, Usage } from './api';

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
  /** The student pressed Stop, so the answer ends where it was cut off. */
  stopped?: boolean;
  error?: string;
}

/** What a new chat searches. An existing thread keeps its own scope. */
export type NewChatScope = Pick<ChatRequest, 'scope' | 'video_id' | 'workspace_id'>;

/** Jumps the player to a moment in a lecture. */
export type SeekHandler = (videoId: number, seconds: number) => void;
