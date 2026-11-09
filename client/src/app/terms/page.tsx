import { TermsContent } from '@/components/legal/TermsContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { legalMetadata, legalPage } from '@/lib/legal';

export const metadata = legalMetadata('/terms');

export default function Page() {
  return (
    <DocumentWindow title={legalPage('/terms').title}>
      <TermsContent />
    </DocumentWindow>
  );
}
