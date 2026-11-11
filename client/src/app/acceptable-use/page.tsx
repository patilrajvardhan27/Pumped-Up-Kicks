import { AcceptableUseContent } from '@/components/legal/AcceptableUseContent';
import { ArticleShell } from '@/components/site/PageShell';
import { legalMetadata } from '@/lib/legal';

export const metadata = legalMetadata('/acceptable-use');

export default function Page() {
  return (
    <ArticleShell>
      <AcceptableUseContent />
    </ArticleShell>
  );
}
