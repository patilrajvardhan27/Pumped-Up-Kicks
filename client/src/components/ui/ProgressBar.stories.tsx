import preview from '#.storybook/preview';
import { ProgressBar } from './ProgressBar';

const meta = preview.meta({ title: 'UI/ProgressBar', component: ProgressBar, args: { label: 'Upload progress', value: 45 } });

export const Halfway = meta.story({});
export const Working = meta.story({ args: { busy: true } });
export const NearLimit = meta.story({ args: { value: 92, tone: 'danger', label: 'Monthly allowance used' } });
export const Done = meta.story({ args: { value: 100, tone: 'success' } });
