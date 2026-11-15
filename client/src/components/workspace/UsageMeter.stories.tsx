import preview from '#.storybook/preview';
import { UsageMeter } from './UsageMeter';

const meta = preview.meta({ title: 'Workspace/UsageMeter', component: UsageMeter });

/** Close to the monthly limit: the bar turned red before the student ran out. */
export const NearLimit = meta.story({});
