/* Every word on the landing page, kept apart from layout so copy edits touch one file. */

export const HERO = {
  badge: 'Built for university lectures',
  title: 'Ask your lectures anything.',
  body: 'Upload a recording or connect Canvas. Every answer links to the exact second your professor said it, so you jump to the moment instead of scrubbing.',
  primary: { href: '/app', label: 'Start studying free' },
  secondary: { href: '/#how', label: 'See how it works' },
  note: 'No card needed. Your recordings stay private to you.',
};

/* Where students' recordings come from. Plain names, no logos: any MP4 export works. */
export const SOURCES = ['Zoom', 'Panopto', 'Echo360', 'Microsoft Teams', 'Kaltura', 'Canvas'];

export const STEPS = [
  { title: 'Upload a lecture', body: 'Drop in a recording, or sync a whole course from Canvas.' },
  { title: 'We transcribe it', body: 'Every word is timestamped and indexed for search by meaning.' },
  { title: 'Ask anything', body: 'Answers cite the second they came from. Click to play it back.' },
];

export interface Feature {
  title: string;
  body: string;
}

export interface FeatureSection {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  visual: 'study' | 'course' | 'privacy';
  items: Feature[];
}

export const FEATURES: FeatureSection[] = [
  {
    id: 'study',
    eyebrow: 'Study tools',
    title: 'Revise from what was actually said.',
    intro: 'Turn a two-hour lecture into something you can learn from in twenty minutes.',
    visual: 'study',
    items: [
      { title: 'Study guides', body: 'A summary, key terms and an outline for each lecture, every point linked to its timestamp.' },
      { title: 'Practice questions and flashcards', body: 'Built from a subject’s lectures and readings, each one citing where its answer comes from.' },
      { title: 'Searchable transcripts', body: 'Read the whole lecture, search it like a document, and click any line to hear it.' },
    ],
  },
  {
    id: 'course',
    eyebrow: 'Your course',
    title: 'One place for the whole semester.',
    intro: 'Lectures, slides and readings, organised the way your timetable is.',
    visual: 'course',
    items: [
      { title: 'Subjects', body: 'File lectures and documents by subject, and ask across one subject or all of them.' },
      { title: 'Canvas sync', body: 'Bring in course files, pages and announcements, and see deadlines beside your lectures.' },
      { title: 'Notes you keep', body: 'Download any chat as Markdown for Notion, Obsidian or your revision doc.' },
    ],
  },
  {
    id: 'privacy',
    eyebrow: 'Privacy',
    title: 'Your lectures stay yours.',
    intro: 'Built so that nobody else, including other students, ever sees what you upload.',
    visual: 'privacy',
    items: [
      { title: 'Only your data', body: 'Every search and answer is limited to your own account, enforced on every request.' },
      { title: 'Delete or download any time', body: 'Export everything, or delete your account and all of it, from Your data.' },
      { title: 'Never used for training', body: 'Your recordings, transcripts and chats are not used to train AI models.' },
    ],
  },
];

export const CLOSING = {
  title: 'Your next lecture, already searchable.',
  body: 'Free to start. Upload one recording and ask it something.',
  cta: { href: '/app', label: 'Open the workspace' },
};
