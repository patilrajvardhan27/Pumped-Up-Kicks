import preview from '#.storybook/preview';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { streamHandler } from '@/stories/handlers';
import { LECTURE, VIDEOS, turn } from '@/stories/fixtures';
import { recordedAnswer } from '@/stories/sse';
import { useAppStore } from '@/stores/appStore';
import { ChatPanel } from './ChatPanel';

const meta = preview.meta({
  title: 'Chat/ChatPanel',
  component: ChatPanel,
  args: {
    videos: VIDEOS,
    scope: { scope: 'video' as const, video_id: LECTURE.id },
    scopeLabel: LECTURE.title,
    hasContent: true,
    onSeek: fn(),
  },
  decorators: [(Story) => <div className="flex h-[36rem] flex-col"><Story /></div>],
});

const ask = async (canvasElement: HTMLElement) => {
  const box = within(canvasElement).getByRole('textbox', { name: 'Your question' });
  await userEvent.type(box, 'Why does the gradient vanish?{Enter}');
};

export const Empty = meta.story({});

/** The real stream, replayed by MSW: the answer filled in piece by piece, then its sources appeared. */
export const StreamingAnswer = meta.story({
  play: async ({ canvasElement }) => {
    await ask(canvasElement);
    const page = within(canvasElement);
    await expect(await page.findByRole('button', { name: 'Stop' })).toBeVisible();
    await waitFor(() => expect(page.getByText(/three fixes/)).toBeVisible(), { timeout: 8000 });
    await waitFor(() => expect(page.getByRole('button', { name: 'Ask' })).toBeVisible(), { timeout: 8000 });
    await expect(useAppStore.getState().conversationId).toBe(101);
  },
});

/** Stop cut the answer off where it was and said so. */
export const CancelMidStream = meta.story({
  beforeEach({ msw }) {
    msw.use(streamHandler(recordedAnswer(), 250));
  },
  play: async ({ canvasElement }) => {
    await ask(canvasElement);
    const page = within(canvasElement);
    await waitFor(() => expect(useAppStore.getState().thread.turns[0]?.answer).not.toBe(''), { timeout: 5000 });
    await userEvent.click(page.getByRole('button', { name: 'Stop' }));
    await expect(await page.findByText('You stopped this answer here.')).toBeVisible();
    await expect(useAppStore.getState().busy).toBe(false);
  },
});

/** Set straight in the store: the same state the app reads, no network needed. */
export const ThreadFromStore = meta.story({
  beforeEach() {
    useAppStore.setState({ conversationId: 7, thread: { id: 7, turns: [turn(), turn({ key: 't2', question: 'And how do residual connections help?' })] } });
  },
});
