import { SecurityContent } from '@/components/legal/SecurityContent';
import { ArticleShell } from '@/components/site/PageShell';
import { legalMetadata } from '@/lib/legal';

export const metadata = legalMetadata('/security');

export default function Page() {
  return (
    <ArticleShell>
      <SecurityContent />
    </ArticleShell>
  );
}
