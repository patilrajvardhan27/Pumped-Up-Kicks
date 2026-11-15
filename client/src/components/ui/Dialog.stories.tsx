import preview from '#.storybook/preview';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from './Button';
import { Dialog } from './Dialog';

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Canvas</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Canvas">
        <p className="text-body text-slate-gray">Choose which courses to import, then sync.</p>
        <Button variant="secondary" className="mt-4">Import and sync</Button>
      </Dialog>
    </>
  );
}

// No `component` here: the story rendered its own opener, so Dialog's props weren't story args.
const meta = preview.meta({ title: 'UI/Dialog', render: () => <DialogDemo /> });

export const Closed = meta.story({});

/** Opening moved focus into the dialog; Esc closed it and focus went back to the button. */
export const EscapeAndFocus = meta.story({
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const opener = page.getByRole('button', { name: 'Open Canvas' });
    await userEvent.click(opener);

    const dialog = await page.findByRole('dialog', { name: 'Canvas' });
    await waitFor(() => expect(dialog.contains(dialog.ownerDocument.activeElement)).toBe(true));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
});
