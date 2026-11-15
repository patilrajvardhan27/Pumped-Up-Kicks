import preview from '#.storybook/preview';
import { fn } from 'storybook/test';
import { ChatEmptyState } from './ChatEmptyState';

const meta = preview.meta({
  title: 'Chat/ChatEmptyState',
  component: ChatEmptyState,
  args: { hasContent: true, scope: 'video' as const, scopeLabel: 'Lecture 7', onAsk: fn() },
});

export const ReadyToAsk = meta.story({});
export const Subject = meta.story({ args: { scope: 'workspace', scopeLabel: 'Deep Learning' } });
export const NothingYet = meta.story({ args: { hasContent: false, scope: 'all', scopeLabel: 'your library' } });
