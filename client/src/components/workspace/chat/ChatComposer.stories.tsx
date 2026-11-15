import preview from '#.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChatComposer } from './ChatComposer';

const meta = preview.meta({
  title: 'Chat/ChatComposer',
  component: ChatComposer,
  args: { placeholder: 'Ask Lecture 7…', disabled: false, busy: false, onAsk: fn(), onStop: fn() },
});

export const Empty = meta.story({});
export const Disabled = meta.story({ args: { disabled: true, placeholder: 'Add a lecture first' } });
export const Streaming = meta.story({ args: { busy: true } });

/** Enter sent the question and cleared the box. */
export const EnterSends = meta.story({
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('textbox', { name: 'Your question' });
    await userEvent.type(box, 'Why does the gradient vanish?{Enter}');
    await expect(args.onAsk).toHaveBeenCalledWith('Why does the gradient vanish?');
    await expect(box).toHaveValue('');
  },
});

/** Shift+Enter added a line instead of sending. */
export const ShiftEnterAddsLine = meta.story({
  play: async ({ canvasElement, args }) => {
    const box = within(canvasElement).getByRole('textbox', { name: 'Your question' });
    await userEvent.type(box, 'First line{Shift>}{Enter}{/Shift}Second line');
    await expect(box).toHaveValue('First line\nSecond line');
    await expect(args.onAsk).not.toHaveBeenCalled();
  },
});

/** Near the 2,000 character limit the box counted characters for you. */
export const NearTheLimit = meta.story({
  play: async ({ canvasElement }) => {
    const box = within(canvasElement).getByRole('textbox', { name: 'Your question' });
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(1900));
    await expect(within(canvasElement).getByText('1,900 / 2,000 characters')).toBeVisible();
  },
});
