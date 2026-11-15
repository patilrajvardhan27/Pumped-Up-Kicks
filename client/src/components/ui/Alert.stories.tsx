import preview from '#.storybook/preview';
import { fn } from 'storybook/test';
import { Alert } from './Alert';

const meta = preview.meta({
  title: 'UI/Alert',
  component: Alert,
  args: { children: 'Choose which courses to import, then sync.' },
});

export const Info = meta.story({ args: { tone: 'info', title: 'Canvas connected' } });
export const Success = meta.story({ args: { tone: 'success', title: 'Uploaded' } });
export const Danger = meta.story({ args: { tone: 'danger', title: 'Upload failed', children: 'The server did not answer. Try again.' } });
export const Dismissible = meta.story({ args: { tone: 'info', onClose: fn() } });
