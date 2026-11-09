import { CookiesContent } from '@/components/legal/CookiesContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';
import { legalMetadata, legalPage } from '@/lib/legal';

export const metadata = legalMetadata('/cookies');

export default function Page() {
  return (
    <DocumentWindow title={legalPage('/cookies').title}>
      <CookiesContent />
    </DocumentWindow>
  );
}
