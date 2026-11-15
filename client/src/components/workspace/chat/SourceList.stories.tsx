import preview from '#.storybook/preview';
import { fn } from 'storybook/test';
import { MANY_SOURCES, source } from '@/stories/fixtures';
import { SourceList } from './SourceList';

const meta = preview.meta({
  title: 'Chat/SourceList',
  component: SourceList,
  args: { sources: MANY_SOURCES, activeIndex: null, registerItem: () => () => {}, onSeek: fn() },
});

export const None = meta.story({ args: { sources: [] } });
export const One = meta.story({ args: { sources: [source(724)] } });
export const Twelve = meta.story({});
export const OneActive = meta.story({ args: { activeIndex: 2 } });
