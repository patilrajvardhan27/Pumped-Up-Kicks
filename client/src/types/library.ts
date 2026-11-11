/* Lectures, subjects and imported course documents, as the API returns them. */

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
  /** Older servers also send `storage_key`; nothing here reads it. */
  storage_key?: string;
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

type DocumentSource =
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
