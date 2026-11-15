import preview from '#.storybook/preview';
import { SkeletonLines, SkeletonRows } from './Skeleton';

const meta = preview.meta({ title: 'UI/Skeleton', component: SkeletonLines, args: { label: 'Loading chat' } });

export const Lines = meta.story({});
export const Rows = meta.story({ render: () => <SkeletonRows label="Loading lectures" rows={3} /> });
