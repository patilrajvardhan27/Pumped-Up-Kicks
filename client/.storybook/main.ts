import { defineMain } from '@storybook/nextjs-vite/node';

export default defineMain({
  framework: '@storybook/nextjs-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-vitest', 'msw-storybook-addon'],
  // The MSW worker lived here so it never shipped with the Next app.
  staticDirs: ['./public'],
  core: { disableTelemetry: true },
  // Pinned so stories never reached Clerk, PostHog or a real API, whatever was in .env.
  env: (config) => ({
    ...config,
    NEXT_PUBLIC_API_URL: 'http://localhost:8000',
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '',
  }),
});
