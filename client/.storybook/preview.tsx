import addonA11y from '@storybook/addon-a11y';
import addonDocs from '@storybook/addon-docs';
import { definePreview } from '@storybook/nextjs-vite';
import addonMsw from 'msw-storybook-addon';
import { setupWorker } from 'msw/browser';
import { Manrope } from 'next/font/google';
import { setTokenGetter } from '@/lib/authToken';
import { resetAppStore } from '@/stores/appStore';
import { defaultHandlers } from '@/stories/handlers';
import '@/styles/globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export default definePreview({
  addons: [
    addonDocs(),
    addonA11y(),
    addonMsw(async () => {
      // Every story started from the same fake API; a story overrode just what it needed.
      const worker = setupWorker(...defaultHandlers);
      await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
      return worker;
    }),
  ],
  parameters: {
    layout: 'padded',
    // Any accessibility violation failed the story's test, in the UI and in CI.
    a11y: { test: 'error' },
  },
  beforeEach() {
    // A signed-in student, as far as the API client could tell, and a fresh store.
    setTokenGetter(async () => 'storybook-session');
    resetAppStore();
    return () => setTokenGetter(null);
  },
  decorators: [
    (Story) => (
      <div className={`${manrope.variable} font-sans text-ink-navy`}>
        <Story />
      </div>
    ),
  ],
});
