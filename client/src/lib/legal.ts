import type { Metadata } from 'next';

export interface LegalPage {
  path: string;
  /** Page and window title. */
  title: string;
  /** Footer and menu label. */
  label: string;
  /** Menu subtitle. */
  blurb: string;
  description: string;
}

/* One list behind the pages' metadata, the footer, the menus and the sitemap. */
export const LEGAL_PAGES = [
  {
    path: '/privacy',
    title: 'Privacy policy',
    label: 'Privacy',
    blurb: 'What we collect and why',
    description:
      'What Pumped Up Kicks collects, why, which providers see it, how long it is kept, and how to export or delete it.',
  },
  {
    path: '/terms',
    title: 'Terms of service',
    label: 'Terms',
    blurb: 'The rules of the service',
    description:
      'The rules for using Pumped Up Kicks: what you may upload, how AI answers should be used, plan limits and how to end your use.',
  },
  {
    path: '/acceptable-use',
    title: 'Acceptable use and academic integrity',
    label: 'Acceptable use',
    blurb: 'Recording, sharing and studying fairly',
    description:
      'Which recordings you may upload, how to respect classmates and instructors, and how to use AI study tools without breaking academic integrity rules.',
  },
  {
    path: '/cookies',
    title: 'Cookie policy',
    label: 'Cookies',
    blurb: 'Every cookie, and how to refuse',
    description: 'Every cookie and browser storage entry Pumped Up Kicks uses, what each is for, and how to turn them off.',
  },
  {
    path: '/security',
    title: 'Security',
    label: 'Security',
    blurb: 'How data is protected',
    description: 'How Pumped Up Kicks protects your account and lectures, and how to report a vulnerability.',
  },
] as const satisfies readonly LegalPage[];

export type LegalPath = (typeof LEGAL_PAGES)[number]['path'];

export function legalPage(path: LegalPath): LegalPage {
  return LEGAL_PAGES.find((page) => page.path === path) as LegalPage;
}

export function legalMetadata(path: LegalPath): Metadata {
  const { title, description } = legalPage(path);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
    twitter: { title, description },
  };
}
