'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Input';

interface ChatComposerProps {
  placeholder: string;
  disabled: boolean;
  busy: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}

/** Mirrors the API's limit, so an over-long question is stopped before it is sent. */
const QUESTION_MAX_CHARS = 2000;
const WARN_AT = QUESTION_MAX_CHARS - 200;

export function ChatComposer({ placeholder, disabled, busy, onAsk, onStop }: ChatComposerProps) {
  const [question, setQuestion] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim() || busy || disabled) return;
        onAsk(question);
        setQuestion('');
      }}
      className="flex shrink-0 items-start gap-3 border-t border-pebble pt-4"
    >
      <TextArea
        id="chat-question"
        rows={1}
        name="question"
        label="Your question"
        labelHidden
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={placeholder}
        maxLength={QUESTION_MAX_CHARS}
        helperText={
          question.length >= WARN_AT
            ? `${question.length.toLocaleString('en-US')} / ${QUESTION_MAX_CHARS.toLocaleString('en-US')} characters`
            : undefined
        }
        disabled={busy || disabled}
        autoComplete="off"
        className="flex-1"
        onKeyDown={(event) => {
          // Enter sent the question; Shift+Enter, or Enter while an IME was composing, added a line.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
      />
      {busy ? (
        <Button variant="secondary" onClick={onStop}>
          Stop
        </Button>
      ) : (
        <Button type="submit" disabled={!question.trim() || disabled}>
          Ask
        </Button>
      )}
    </form>
  );
}
