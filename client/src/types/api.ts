export interface Source {
  chunk_id?: number;
  video_id?: number;
  text: string;
  timestamp: string;
  video: string;
  start?: number;
  end?: number;
  similarity?: number;
  video_duration?: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  model: string;
  cost_usd: number;
}

export interface Quota {
  plan: string;
  spent_usd: number;
  limit_usd: number;
  remaining_usd: number;
  percent_used: number;
  exhausted: boolean;
}

/** "ask" answers a typed question; the others are one-click study tools. */
export type ChatMode = 'ask' | 'notes' | 'terms' | 'quiz';

export interface ChatRequest {
  question: string;
  mode?: ChatMode;
  conversation_id?: number;
  video_id?: number;
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

export interface MessageItem {
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
  video_id?: number | null;
  video_title?: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends ConversationItem {
  messages: MessageItem[];
}

export interface UsageSummary {
  questions_asked: number;
  cache_hits: number;
  total_cost_usd: number;
  quota: Quota;
}

export type VideoStage = 'queued' | 'transcribing' | 'indexing' | 'ready' | 'failed';

export interface VideoInfo {
  id: number;
  filename: string;
  title?: string;
  duration?: number;
  uploaded_at: string;
  file_size?: number;
  stage: VideoStage;
  stage_label: string;
  progress: number;
  error_message?: string | null;
  num_chunks?: number | null;
}

export interface VideoListResponse {
  total: number;
  videos: VideoInfo[];
}

export interface PresignResponse {
  video_id: number;
  upload_url: string | null;
  /** Must be sent unchanged with the upload: it is part of the signed URL. */
  content_type: string;
}

export interface PlaybackResponse {
  url: string;
  expires_in: number;
  duration?: number | null;
  content_type: string;
}

export interface UploadResponse {
  message: string;
  video_id: number;
  filename: string;
  status: string;
}

export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResponse {
  video_id: number;
  title: string;
  lines: TranscriptLine[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'unreachable';
  ready: boolean;
}
