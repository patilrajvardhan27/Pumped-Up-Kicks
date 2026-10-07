import type { Metadata } from 'next';
import { PrivacyContent } from '@/components/legal/PrivacyContent';
import { DocumentWindow } from '@/components/shell/DocumentWindow';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What Pumped Up Kicks collects, why, which providers see it, how long it is kept, and the choices you have.',
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Privacy policy', description:
    'What Pumped Up Kicks collects, why, which providers see it, how long it is kept, and the choices you have.', url: '/privacy' },
  twitter: { title: 'Privacy policy', description:
    'What Pumped Up Kicks collects, why, which providers see it, how long it is kept, and the choices you have.' },
};

export default function PrivacyPage() {
  return (
    <DocumentWindow title="Privacy policy">
      <PrivacyContent />
    </DocumentWindow>
  );
}
