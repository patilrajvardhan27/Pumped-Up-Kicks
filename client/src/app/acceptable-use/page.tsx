import { AcceptableUseContent } from '@/components/legal/AcceptableUseContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { legalMetadata, legalPage } from '@/lib/legal';

export const metadata = legalMetadata('/acceptable-use');

export default function Page() {
  return (
    <DocumentWindow title={legalPage('/acceptable-use').title}>
      <AcceptableUseContent />
    </DocumentWindow>
  );
}
