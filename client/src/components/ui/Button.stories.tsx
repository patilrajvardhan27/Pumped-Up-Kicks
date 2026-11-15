import preview from '#.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  title: 'UI/Button',
  component: Button,
  args: { children: 'Ask' },
});

export const Primary = meta.story({});
export const Dark = meta.story({ args: { variant: 'dark', children: 'Get started' } });
export const Secondary = meta.story({ args: { variant: 'secondary', children: 'Stop' } });
export const Tertiary = meta.story({ args: { variant: 'tertiary', children: 'Your data' } });
export const Small = meta.story({ args: { size: 'sm', children: 'New subject' } });
export const Disabled = meta.story({ args: { disabled: true, children: 'Upload and process' } });
