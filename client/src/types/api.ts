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

export interface Quota {
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
export interface ContentQuota {
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

export type VideoStage = 'queued' | 'transcribing' | 'indexing' | 'ready' | 'failed';

export interface VideoInfo {
  id: number;
  /** The subject this lecture is filed under; null is Unsorted. */
  workspace_id: number | null;
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

/** Keys into a fixed palette; lib/workspaces.ts maps them onto design tokens. */
export type WorkspaceColor = 'blue' | 'green' | 'red' | 'purple' | 'teal' | 'olive';

export type WorkspaceIcon =
  | 'book'
  | 'flask'
  | 'function'
  | 'code'
  | 'globe'
  | 'atom'
  | 'dna'
  | 'chart'
  | 'palette'
  | 'music'
  | 'scales'
  | 'brain';

/** A subject: a named group of lectures and the chats about them. */
export interface WorkspaceInfo {
  id: number;
  name: string;
  color: WorkspaceColor;
  icon: WorkspaceIcon;
  position: number;
  canvas_course_id?: number | null;
  video_count: number;
  /** Course material imported from Canvas. */
  document_count: number;
  created_at: string;
}

export interface WorkspaceDraft {
  name: string;
  color: WorkspaceColor;
  icon: WorkspaceIcon;
}

export type DocumentSource =
  | 'canvas_file'
  | 'canvas_page'
  | 'canvas_syllabus'
  | 'canvas_announcement'
  | 'canvas_assignment';

/** Course material imported from Canvas. */
export interface DocumentInfo {
  id: number;
  workspace_id: number | null;
  source: DocumentSource;
  title: string;
  mime_type?: string | null;
  url?: string | null;
  module_name?: string | null;
  module_position?: number | null;
  num_pages?: number | null;
  num_chunks: number;
  updated_at?: string | null;
}

export type CanvasSyncStage = 'idle' | 'queued' | 'syncing' | 'ready' | 'failed';

export interface CanvasSyncSummary {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  deadlines: number;
  skipped: string[];
}

export interface CanvasSync {
  stage: CanvasSyncStage;
  progress: number;
  detail?: string | null;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  summary?: CanvasSyncSummary | null;
}

/** Never carries a token: the server keeps those to itself. */
export interface CanvasStatus {
  connected: boolean;
  base_url?: string | null;
  auth_type?: 'oauth' | 'personal_token' | null;
  connected_at?: string | null;
  sync?: CanvasSync | null;
  /** Schools this server has a developer key for. */
  schools: string[];
  personal_tokens_allowed: boolean;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string | null;
  term?: string | null;
  workspace_id?: number | null;
}

export interface CanvasSyncRequest {
  /** workspace_id null creates a subject named after the course. */
  link?: { course_id: number; workspace_id: number | null }[];
  unlink?: number[];
}
