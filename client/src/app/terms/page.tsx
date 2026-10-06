import type { Metadata } from 'next';
import { TermsContent } from '@/components/legal/TermsContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';

export const metadata: Metadata = {
  title: 'Terms of service',
  description:
    'The rules for using Pumped Up Kicks: what you may upload, how AI answers should be used, plan limits and how to end your use.',
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms of service', description:
    'The rules for using Pumped Up Kicks: what you may upload, how AI answers should be used, plan limits and how to end your use.', url: '/terms' },
  twitter: { title: 'Terms of service', description:
    'The rules for using Pumped Up Kicks: what you may upload, how AI answers should be used, plan limits and how to end your use.' },
};

export default function TermsPage() {
  return (
    <DocumentWindow title="Terms of service">
      <TermsContent />
    </DocumentWindow>
  );
}
