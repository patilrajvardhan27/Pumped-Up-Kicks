import preview from '#.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ANSWER, LECTURE, MANY_SOURCES, SECOND_LECTURE, turn } from '@/stories/fixtures';
import { ChatTurn } from './ChatTurn';

const durations = { [LECTURE.title]: LECTURE.duration, [SECOND_LECTURE.title]: SECOND_LECTURE.duration };

const meta = preview.meta({
  title: 'Chat/ChatTurn',
  component: ChatTurn,
  args: { turn: turn(), durations, onSeek: fn() },
});

export const Streaming = meta.story({
  args: { turn: turn({ answer: ANSWER.slice(0, 120), sources: [], streaming: true, usage: undefined }) },
});

export const Waiting = meta.story({ args: { turn: turn({ answer: '', sources: [], streaming: true, usage: undefined }) } });

/** Clicking a citation asked the player to seek to that lecture and second. */
export const Finished = meta.story({
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getAllByRole('button', { name: 'Play from 12:04' })[0]);
    await expect(args.onSeek).toHaveBeenCalledWith(LECTURE.id, 724);
  },
});

export const FailedPartway = meta.story({
  args: { turn: turn({ answer: ANSWER.slice(0, 80), error: 'The answer did not finish. Send the question again.' }) },
});

export const Stopped = meta.story({ args: { turn: turn({ answer: ANSWER.slice(0, 160), sources: [], stopped: true }) } });

export const ManySources = meta.story({ args: { turn: turn({ sources: MANY_SOURCES }) } });
