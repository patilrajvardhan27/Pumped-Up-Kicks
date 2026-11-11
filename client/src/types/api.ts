/** One cited passage: from a lecture (with timestamps) or a course document (with a page or slide). */
export interface Source {
  kind?: 'video' | 'document';
  chunk_id?: number;
  video_id?: number;
  text: string;
  /** "12:04 - 13:19" for a lecture; "p. 4", "slide 4" or "" for a document. */
  timestamp: string;
  /** The source's display name: the lecture or document title. */
  video: string;
  start?: number;
  end?: number;
  similarity?: number;
  video_duration?: number;
  document_id?: number;
  document_title?: string;
  page?: number | null;
  /** Where to open a document: the item in Canvas. */
  url?: string | null;
  /** How the answer cites a document passage, such as "Doc 3". */
  ref?: string | null;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  model: string;
  cost_usd: number;
}

interface Quota {
  plan: string;
  spent_usd: number;
  limit_usd: number;
  remaining_usd: number;
  percent_used: number;
  exhausted: boolean;
}

/**
 * What a chat searches: one lecture, one subject (a null workspace_id means
 * the Unsorted lectures), or every lecture.
 */
export type ChatScope = 'video' | 'workspace' | 'all';

export interface ChatRequest {
  question: string;
  conversation_id?: number;
  scope?: ChatScope;
  video_id?: number;
  workspace_id?: number | null;
  top_k?: number;
}

/** Events emitted by POST /api/chat/stream. */
export type StreamEvent =
  | { type: 'conversation'; conversation_id: number }
  | { type: 'sources'; sources: Source[] }
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      answer: string;
      sources: Source[];
      num_sources: number;
      response_time: number;
      usage: Usage;
    }
  | { type: 'error'; message: string };

interface MessageItem {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources: Source[];
  cost_usd?: number | null;
  cache_hit: boolean;
}

export interface ConversationItem {
  id: number;
  title?: string | null;
  scope: ChatScope;
  video_id?: number | null;
  /** The subject the thread is filed under; null is Unsorted (or, for scope 'all', none). */
  workspace_id?: number | null;
  video_title?: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends ConversationItem {
  messages: MessageItem[];
}

/** Indexed passages (lectures and imported course material) against the plan's allowance. */
interface ContentQuota {
  used_chunks: number;
  limit_chunks: number;
  remaining_chunks: number;
  percent_used: number;
}

export interface UsageSummary {
  questions_asked: number;
  cache_hits: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  model: string;
  quota: Quota;
  content: ContentQuota;
}

export * from './library';
export * from './integrations';
