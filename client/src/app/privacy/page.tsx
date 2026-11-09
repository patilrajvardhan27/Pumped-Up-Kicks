import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { legalMetadata, legalPage } from '@/lib/legal';

export const metadata = legalMetadata('/privacy');

export default function Page() {
  return (
    <DocumentWindow title={legalPage('/privacy').title}>
      <PrivacyContent />
    </DocumentWindow>
  );
}
