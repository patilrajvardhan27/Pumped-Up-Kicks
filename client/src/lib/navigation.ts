import { LEGAL_PAGES } from '@/lib/legal';

export interface NavLink {
  href: string;
  label: string;
}

/* The marketing nav. The header shows these; the footer repeats them under Product. */
export const PRODUCT_LINKS: NavLink[] = [
  { href: '/#how', label: 'How it works' },
  { href: '/#study', label: 'Study tools' },
  { href: '/#course', label: 'Your course' },
  { href: '/#privacy', label: 'Privacy' },
];

/* Footer columns. Legal links come from the one registry of policy pages. */
export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  { title: 'Product', links: PRODUCT_LINKS },
  {
    title: 'Workspace',
    links: [
      { href: '/app', label: 'Open the workspace' },
      { href: '/app/account', label: 'Your data' },
    ],
  },
  { title: 'Policies', links: LEGAL_PAGES.map((page) => ({ href: page.path, label: page.label })) },
];
