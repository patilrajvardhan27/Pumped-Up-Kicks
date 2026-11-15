import preview from '#.storybook/preview';
import { expect, fn, userEvent, within } from 'storybook/test';
import { CitationChip } from './CitationChip';

const meta = preview.meta({ title: 'Chat/CitationChip', component: CitationChip, args: { label: '12:04', onPlay: fn() } });

export const Lecture = meta.story({
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Play from 12:04' }));
    await expect(args.onPlay).toHaveBeenCalledOnce();
  },
});
export const Unmatched = meta.story({ args: { onPlay: undefined } });
export const Document = meta.story({ args: { kind: 'document', label: 'Week 7 slides, p. 4', href: 'https://canvas.example.edu/files/1', onPlay: undefined } });
