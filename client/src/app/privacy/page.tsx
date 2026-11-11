import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { ArticleShell } from '@/components/site/PageShell';
import { legalMetadata } from '@/lib/legal';

export const metadata = legalMetadata('/privacy');

export default function Page() {
  return (
    <ArticleShell>
      <PrivacyContent />
    </ArticleShell>
  );
}
