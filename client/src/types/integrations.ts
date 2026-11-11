/* Canvas, study tools, deadlines and search, as the API returns them. */
import type { Source } from './api';

type CanvasSyncStage = 'idle' | 'queued' | 'syncing' | 'ready' | 'failed';

interface CanvasSyncSummary {
  added: number;
  updated: number;
  unchanged: number;
  removed: number;
  deadlines: number;
  skipped: string[];
}

interface CanvasSync {
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

interface KeyTerm {
  term: string;
  definition: string;
  /** Seconds into the lecture where it is explained, when that could be checked. */
  start?: number | null;
}

export interface StudyGuide {
  video_id: number;
  summary: string;
  key_terms: KeyTerm[];
  outline: { start: number; title: string }[];
  /** Set when the lecture was too long to read whole: the guide covers up to here. */
  covered_until_s?: number | null;
  cost_usd?: number | null;
  created_at: string;
}

/** Where a practice item's answer comes from: a moment in a lecture or a page of a document. */
export type PracticeSource = Pick<
  Source,
  'kind' | 'chunk_id' | 'video_id' | 'start' | 'end' | 'timestamp' | 'video' | 'document_id' | 'document_title' | 'page' | 'url'
>;

export type PracticeKind = 'questions' | 'flashcards';

export interface PracticeItem {
  question?: string;
  answer?: string;
  front?: string;
  back?: string;
  source: PracticeSource;
}

export interface PracticeSet {
  id: number;
  workspace_id: number;
  kind: PracticeKind;
  focus?: string | null;
  items: PracticeItem[];
  cost_usd?: number | null;
  created_at: string;
}

export interface Deadline {
  id: number;
  workspace_id: number | null;
  title: string;
  due_at: string;
  url?: string | null;
  points_possible?: number | null;
  is_quiz: boolean;
}

export interface SearchHit {
  kind: 'video' | 'document';
  chunk_id: number;
  title: string;
  /** Plain text; matches are wrapped in ⟦ and ⟧. */
  snippet: string;
  rank: number;
  video_id?: number | null;
  start?: number | null;
  end?: number | null;
  timestamp?: string | null;
  document_id?: number | null;
  page?: number | null;
  page_label?: string | null;
  url?: string | null;
}
