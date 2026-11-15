import preview from '#.storybook/preview';
import { expect, within } from 'storybook/test';
import { healthHandler } from '@/stories/handlers';
import { ServerStatus } from './ServerStatus';

const meta = preview.meta({ title: 'Workspace/ServerStatus', component: ServerStatus });

export const Live = meta.story({
  play: async ({ canvasElement }) => expect(await within(canvasElement).findByText('Live')).toBeVisible(),
});

export const DatabaseDown = meta.story({
  beforeEach({ msw }) {
    msw.use(healthHandler('degraded'));
  },
  play: async ({ canvasElement }) => expect(await within(canvasElement).findByText('No database')).toBeVisible(),
});

export const Offline = meta.story({
  beforeEach({ msw }) {
    msw.use(healthHandler('offline'));
  },
  play: async ({ canvasElement }) => expect(await within(canvasElement).findByText('Server offline')).toBeVisible(),
});
