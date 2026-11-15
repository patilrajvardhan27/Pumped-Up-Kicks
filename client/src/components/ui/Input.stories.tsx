import preview from '#.storybook/preview';
import { Input, TextArea } from './Input';

const meta = preview.meta({
  title: 'UI/Input',
  component: Input,
  args: { id: 'subject-name', label: 'Subject name', placeholder: 'Machine learning' },
});

export const Empty = meta.story({});
export const WithHelp = meta.story({ args: { helperText: 'Up to 60 characters.' } });
export const WithError = meta.story({ args: { defaultValue: 'Physics', error: 'You already have a subject called Physics.' } });
export const Disabled = meta.story({ args: { disabled: true, defaultValue: 'Read only' } });

export const MultiLine = meta.story({
  render: () => <TextArea id="question" label="Your question" defaultValue={'First line\nSecond line'} />,
});
