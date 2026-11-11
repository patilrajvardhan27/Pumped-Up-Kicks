import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { AnalyticsProvider } from '@/components/consent/AnalyticsProvider';
import { ConsentBanner } from '@/components/consent/ConsentBanner';
import { site } from '@/lib/site';
import '@/styles/globals.css';

// One family for every text role, with hierarchy built from size and weight.
// Manrope stands in for Gilroy (see docs/DESIGN.md).
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name}: ${site.tagline.toLowerCase()}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name}: ${site.tagline.toLowerCase()}`,
    description: site.description,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name}: ${site.tagline.toLowerCase()}`,
    description: site.description,
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable} data-scroll-behavior="smooth">
      <body>
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-(--z-nav) focus-visible:rounded-lg focus-visible:bg-ink-navy focus-visible:px-4 focus-visible:py-2 focus-visible:text-paper"
        >
          Skip to content
        </a>
        {children}
        <AnalyticsProvider />
        <ConsentBanner />
      </body>
    </html>
  );
}
