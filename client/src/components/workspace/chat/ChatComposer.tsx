'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ChatComposerProps {
  placeholder: string;
  disabled: boolean;
  busy: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}

/** Mirrors the API's limit, so an over-long question is stopped before it is sent. */
export const QUESTION_MAX_CHARS = 2000;
const WARN_AT = QUESTION_MAX_CHARS - 200;

export function ChatComposer({ placeholder, disabled, busy, onAsk, onStop }: ChatComposerProps) {
  const [question, setQuestion] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim() || busy) return;
        onAsk(question);
        setQuestion('');
      }}
      className="flex shrink-0 items-start gap-3 border-t border-hairline-soft pt-4"
    >
      <Input
        id="chat-question"
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
