import preview from '#.storybook/preview';
import { fn } from 'storybook/test';
import { ANSWER, ANSWER_SOURCES } from '@/stories/fixtures';
import { AnswerText } from './AnswerText';

const meta = preview.meta({
  title: 'Chat/AnswerText',
  component: AnswerText,
  args: { text: ANSWER, sources: ANSWER_SOURCES, onSeek: fn() },
});

/** Answers stayed plain text: line breaks and list marks showed as written, never parsed as HTML. */
export const LongAnswer = meta.story({ args: { text: `${ANSWER}\n\n${ANSWER}\n\n${ANSWER}` } });
export const UnmatchedCitation = meta.story({ args: { text: 'This was covered near the end [58:59].', sources: [] } });
export const ScriptStaysText = meta.story({ args: { text: 'Shown as text, not run: <img src=x onerror="alert(1)"> [12:04]' } });
