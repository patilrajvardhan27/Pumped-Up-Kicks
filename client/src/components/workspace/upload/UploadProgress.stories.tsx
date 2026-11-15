import preview from '#.storybook/preview';
import { UploadProgress } from './UploadProgress';

const TOTAL = 812_000_000;
const meta = preview.meta({ title: 'Upload/UploadProgress', component: UploadProgress, args: { percent: 0, sentBytes: 0, totalBytes: TOTAL } });

export const Starting = meta.story({});
export const Halfway = meta.story({ args: { percent: 45, sentBytes: TOTAL * 0.45 } });
export const Done = meta.story({ args: { percent: 100, sentBytes: TOTAL } });
