import preview from '#.storybook/preview';
import { expect, userEvent, within } from 'storybook/test';
import { dropFiles } from '@/stories/events';
import { failingHandler } from '@/stories/handlers';
import { VideoUpload } from './VideoUpload';

const meta = preview.meta({ title: 'Upload/VideoUpload', component: VideoUpload, args: { workspaceId: 1, destination: 'Deep Learning' } });

const zoneOf = (canvasElement: HTMLElement) =>
  within(canvasElement).getByLabelText('Choose a video file, or drop one here').parentElement!;

export const Ready = meta.story({});

/** A dropped notes file was turned away with a message that said what to use instead. */
export const WrongFileType = meta.story({
  play: async ({ canvasElement }) => {
    const notes = new File(['week 7'], 'notes.txt', { type: 'text/plain' });
    dropFiles(zoneOf(canvasElement), [notes]);
    const alert = await within(canvasElement).findByRole('alert');
    await expect(alert).toHaveTextContent('.txt is not a video format we can read');
    await expect(within(canvasElement).getByRole('button', { name: 'Upload and process' })).toBeDisabled();
  },
});

/** The server refused the upload, and the student saw why. */
export const ServerFailed = meta.story({
  beforeEach({ msw }) {
    msw.use(failingHandler('post', '/api/videos/presign', 500, 'Something went wrong on our side. Try again in a moment.'));
  },
  play: async ({ canvasElement }) => {
    const lecture = new File([new Uint8Array(2048)], 'lecture-7.mp4', { type: 'video/mp4' });
    dropFiles(zoneOf(canvasElement), [lecture]);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Upload and process' }));
    const alert = await within(canvasElement).findByRole('alert');
    await expect(alert).toHaveTextContent('Something went wrong on our side');
  },
});
