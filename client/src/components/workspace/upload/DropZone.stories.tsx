import preview from '#.storybook/preview';
import { createRef } from 'react';
import { expect, fireEvent, fn, within } from 'storybook/test';
import { dropFiles } from '@/stories/events';
import { ACCEPTED_EXTENSIONS } from '@/hooks/useVideoUpload';
import { DropZone } from './DropZone';

const lecture = new File([new Uint8Array(2048)], 'lecture-7.mp4', { type: 'video/mp4' });

const meta = preview.meta({
  title: 'Upload/DropZone',
  component: DropZone,
  args: { inputRef: createRef<HTMLInputElement>(), file: null, accept: ACCEPTED_EXTENSIONS, disabled: false, onFile: fn() },
});

export const Idle = meta.story({});
export const WithFile = meta.story({ args: { file: lecture } });
export const Disabled = meta.story({ args: { disabled: true } });

/** A file dragged over the zone lit it up, and dropping it handed the file on. */
export const DraggingOver = meta.story({
  play: async ({ canvasElement, args }) => {
    const zone = within(canvasElement).getByLabelText('Choose a video file, or drop one here').parentElement!;
    await fireEvent.dragOver(zone);
    await expect(zone.className).toContain('bg-pebble');
    dropFiles(zone, [lecture]);
    await expect(args.onFile).toHaveBeenCalledWith(lecture);
  },
});
