import {
  AskIcon,
  LibraryIcon,
  PrivacyIcon,
  TermsIcon,
  PreviewIcon,
  SearchIcon,
  UploadIcon,
  VerifiedIcon,
  WaveformIcon,
} from '@/components/ui/icons';

export interface NavItem {
  href: string;
  label: string;
  description: string;
  Icon: typeof UploadIcon;
}

/* The menu bar and the desktop icons are two views of the same destinations. */
export const PIPELINE_ITEMS: NavItem[] = [
  { href: '#step-upload', label: 'Upload', description: 'Drop in a recording', Icon: UploadIcon },
  { href: '#step-transcribe', label: 'Transcribe', description: 'Timestamped text', Icon: WaveformIcon },
  { href: '#step-index', label: 'Index', description: 'Search by meaning', Icon: SearchIcon },
  { href: '#step-ask', label: 'Ask', description: 'Answers with citations', Icon: AskIcon },
];

export const SECTION_ITEMS: NavItem[] = [
  { href: '#preview', label: 'Preview', description: 'Try the sample lecture', Icon: PreviewIcon },
  { href: '#qualities', label: 'What you get', description: 'Checkable, costed answers', Icon: VerifiedIcon },
];

export const WORKSPACE_ITEMS: NavItem[] = [
  { href: '/app', label: 'Workspace', description: 'Your lectures and chats', Icon: LibraryIcon },
  { href: '/privacy', label: 'Privacy', description: 'What we collect and why', Icon: PrivacyIcon },
  { href: '/terms', label: 'Terms', description: 'The rules of the service', Icon: TermsIcon },
];

/* Menus are looked up by name so server components never pass icons as props. */
export const MENUS = {
  pipeline: PIPELINE_ITEMS,
  all: [...PIPELINE_ITEMS, ...SECTION_ITEMS],
} satisfies Record<string, NavItem[]>;
