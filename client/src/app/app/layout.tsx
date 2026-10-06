import { Providers } from '@/components/providers/Providers';

/**
 * Sign-in belongs to the workspace only. Scoping Clerk here keeps its code and
 * cookies off the landing, legal and 404 pages, which never need an account.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
