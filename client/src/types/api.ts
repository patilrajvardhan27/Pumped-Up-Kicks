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

export interface ChatRequest {
  question: string;
  conversation_id?: number;
  video_id?: number;
  top_k?: number;
}

export interface ChatResponse {
  conversation_id: number;
  message_id: number;
  answer: string;
  sources: Source[];
  response_time: number;
  num_sources: number;
  usage?: Usage;
  cache_hit: boolean;
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

export interface HealthResponse {
  status: string;
  documents_indexed: number;
  embedding_model: string;
  llm_model: string;
  vector_store: string;
}

export interface ServerHealth {
  status: string;
  database: string;
  model: string;
  claude_configured: boolean;
  auth_mode: 'dev' | 'clerk';
  storage_backend: 'local' | 'r2';
  transcribe_backend: 'local' | 'modal';
}

export interface UsageSummary {
  questions_asked: number;
  cache_hits: number;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  model: string;
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
  num_segments?: number | null;
  num_chunks?: number | null;
}

export interface VideoListResponse {
  total: number;
  videos: VideoInfo[];
}

export interface PresignResponse {
  video_id: number;
  upload_url: string | null;
  storage_key: string;
  method: 'PUT' | 'POST';
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
