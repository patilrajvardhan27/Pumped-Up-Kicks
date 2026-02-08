export interface Source {
  text: string;
  timestamp: string;
  video: string;
  start?: number;
  end?: number;
  similarity?: number;
}

export interface ChatRequest {
  question: string;
  video_id?: string;
  session_id?: string;
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  sources: Source[];
  response_time: number;
  num_sources: number;
}

export interface HistoryItem {
  id: number;
  query: string;
  answer: string;
  created_at: string;
  response_time?: number;
  num_sources?: number;
}

export interface HealthResponse {
  status: string;
  documents_indexed: number;
  embedding_model: string;
  llm_model: string;
  vector_store: string;
}

export interface VideoInfo {
  id: number;
  filename: string;
  title?: string;
  duration?: number;
  uploaded_at: string;
  transcription_status: string;
  embedding_status: string;
  file_size?: number;
}

export interface VideoListResponse {
  total: number;
  videos: VideoInfo[];
}

export interface UploadResponse {
  message: string;
  video_id: number;
  filename: string;
  status: string;
}

export interface ApiError {
  detail: string;
}
