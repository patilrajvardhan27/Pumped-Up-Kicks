import { SecurityContent } from '@/components/legal/SecurityContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { legalMetadata, legalPage } from '@/lib/legal';

export const metadata = legalMetadata('/security');

export default function Page() {
  return (
    <DocumentWindow title={legalPage('/security').title}>
      <SecurityContent />
    </DocumentWindow>
  );
}
