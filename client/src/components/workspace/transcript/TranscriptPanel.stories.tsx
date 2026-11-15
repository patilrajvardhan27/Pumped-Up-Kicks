import preview from '#.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import { LECTURE } from '@/stories/fixtures';
import { TranscriptPanel } from './TranscriptPanel';

const meta = preview.meta({
  title: 'Workspace/TranscriptPanel',
  component: TranscriptPanel,
  args: { videoId: LECTURE.id, onSeek: fn() },
  decorators: [(Story) => <div className="flex h-[32rem] flex-col"><Story /></div>],
});

export const LongTranscript = meta.story({});

/** Searching narrowed two hours to one line, and clicking its time sent the player there. */
export const SearchAndJump = meta.story({
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement);
    await userEvent.type(await page.findByRole('searchbox', { name: 'Search the transcript' }), 'gradient vanishes');
    await expect(page.getByText('1 matching passage')).toBeVisible();
    await userEvent.click(page.getByRole('button', { name: 'Play from 12:00' }));
    await expect(args.onSeek).toHaveBeenCalledWith(LECTURE.id, 720);
  },
});
