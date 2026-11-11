import { CookiesContent } from '@/components/legal/CookiesContent';
import { ArticleShell } from '@/components/site/PageShell';
import { legalMetadata } from '@/lib/legal';

export const metadata = legalMetadata('/cookies');

export default function Page() {
  return (
    <ArticleShell>
      <CookiesContent />
    </ArticleShell>
  );
}
