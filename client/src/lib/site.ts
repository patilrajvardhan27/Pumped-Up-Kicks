/*
 * One place for what the site calls itself and who runs it. Operator details
 * come from the environment so a real name and address are never invented in
 * code: set them before launch (see README).
 */
const trimSlash = (value: string) => value.replace(/\/+$/, '');

export const site = {
  name: 'Pumped Up Kicks',
  tagline: 'Ask your lectures',
  description:
    'Upload a lecture recording and ask it anything. Every answer cites the exact timestamp, so you jump to the moment instead of scrubbing.',
  url: trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  /** Who is legally responsible for the service. Shown on the legal pages. */
  operator: process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() || null,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null,
  /** Bump when either legal page changes in substance. */
  legalUpdated: '9 October 2026',
} as const;

export const pageTitle = (title: string) => `${title} | ${site.name}`;
