import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { AnalyticsProvider } from '@/components/consent/AnalyticsProvider';
import { ConsentBanner } from '@/components/consent/ConsentBanner';
import { site } from '@/lib/site';
import '@/styles/globals.css';

// One sans for every text role, with hierarchy built from weight; mono is
// reserved for readouts: timecodes, token counts, sizes.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} data-scroll-behavior="smooth">
      <body>
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-(--z-nav) focus-visible:rounded-md focus-visible:bg-surface-dark focus-visible:px-4 focus-visible:py-2 focus-visible:text-on-dark"
        >
          Skip to content
        </a>
        {/* Everything that animates, the banner included, must sit inside the provider. */}
        <MotionProvider>
          {children}
          <AnalyticsProvider />
          <ConsentBanner />
        </MotionProvider>
      </body>
    </html>
  );
}
