import { TermsContent } from '@/components/legal/TermsContent';
import { ArticleShell } from '@/components/site/PageShell';
import { legalMetadata } from '@/lib/legal';

export const metadata = legalMetadata('/terms');

export default function Page() {
  return (
    <ArticleShell>
      <TermsContent />
    </ArticleShell>
  );
}
