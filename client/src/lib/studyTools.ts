import type { ChatMode } from '@/types/api';

export interface StudyTool {
  mode: Exclude<ChatMode, 'ask'>;
  /** Button text. */
  short: string;
  /** Shown as the question in the chat. Matches the label the server saves. */
  label: string;
  hint: string;
}

/* Whole-lecture tasks. Each reads the full transcript, so they need one lecture selected. */
export const STUDY_TOOLS: StudyTool[] = [
  { mode: 'notes', short: 'Revision notes', label: 'Revision notes for this lecture', hint: 'Topic-by-topic notes' },
  { mode: 'terms', short: 'Key terms', label: 'Key terms from this lecture', hint: 'Definitions to learn' },
  { mode: 'quiz', short: 'Quiz me', label: 'Quiz me on this lecture', hint: '5 practice questions' },
];

/* Typed-question starters, phrased the way students actually ask. */
export const STARTERS = [
  'Explain the hardest part simply',
  'What examples were used?',
  'What might come up in the exam?',
];
