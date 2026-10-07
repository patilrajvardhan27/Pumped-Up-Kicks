import type { Metadata } from 'next';
import { AppWindow } from '@/components/landing/AppWindow';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { DesktopIcons } from '@/components/landing/DesktopIcons';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingMenuBar } from '@/components/landing/LandingMenuBar';
import { MENUS, WORKSPACE_ITEMS } from '@/components/landing/nav-data';
import { Qualities } from '@/components/landing/Qualities';
import { Showcase } from '@/components/landing/Showcase';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Desktop } from '@/components/shell/Desktop';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <Desktop fixed>
      <LandingMenuBar />
      <div className="flex min-h-0 flex-1 gap-3 px-2 pb-2 lg:px-3 lg:pb-8">
        <DesktopIcons label="Shortcuts to sections" items={MENUS.all} />
        <AppWindow title="Pumped Up Kicks: ask your lectures">
          <Hero />
          <div className="pt-8 lg:pt-10">
            <Showcase />
          </div>
          <HowItWorks />
          <Qualities />
          <ClosingCta />
          <SiteFooter />
        </AppWindow>
        <DesktopIcons label="Shortcuts to the app" items={WORKSPACE_ITEMS} />
      </div>
    </Desktop>
  );
}
