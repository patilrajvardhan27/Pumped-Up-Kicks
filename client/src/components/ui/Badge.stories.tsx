import preview from '#.storybook/preview';
import { Badge } from './Badge';

const meta = preview.meta({ title: 'UI/Badge', component: Badge, args: { children: 'Dev mode' } });

export const Default = meta.story({});
export const Status = meta.story({ args: { children: 'Built for university lectures' } });
