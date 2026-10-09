'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SpinnerIcon, TrashIcon } from '@/components/ui/icons';
import { usePractice } from '@/hooks/useStudy';
import { cn } from '@/lib/cn';
import { formatRelativeTime, pluralise } from '@/lib/format';
import type { PracticeItem, PracticeKind, PracticeSet } from '@/types/api';
import type { SeekHandler } from '@/types/chat';
import { SourceCitation } from './SourceCitation';

interface PracticePanelProps {
  workspaceId: number;
  subject: string;
  onSeek?: SeekHandler;
}

const KINDS: { key: PracticeKind; label: string }[] = [
  { key: 'questions', label: 'Practice questions' },
  { key: 'flashcards', label: 'Flashcards' },
];
const COUNTS = [5, 8, 12];

/** Practice questions and flashcards from one subject, each tied to the passage its answer comes from. */
export function PracticePanel({ workspaceId, subject, onSeek }: PracticePanelProps) {
  const practice = usePractice(workspaceId);
  const id = useId();
  const [kind, setKind] = useState<PracticeKind>('questions');
  const [count, setCount] = useState(8);
  const [focus, setFocus] = useState('');

  return (
    <div className="flex flex-col gap-6 py-2">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (await practice.make(kind, count, focus)) setFocus('');
        }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-display-lg text-ink">Practise {subject}</h2>

        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">What to make</legend>
          {KINDS.map((option) => (
            <label key={option.key} className="relative">
              <input
                type="radio"
                name={`${id}-kind`}
                value={option.key}
                checked={kind === option.key}
                onChange={() => setKind(option.key)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-flex min-h-9 cursor-pointer items-center rounded-full border border-hairline-strong px-3.5 text-button-sm text-body',
                  'peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-dark',
                  'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
                )}
              >
                {option.label}
              </span>
            </label>
          ))}
          <label htmlFor={`${id}-count`} className="sr-only">
            How many
          </label>
          <select
            id={`${id}-count`}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="h-9 rounded-full border border-hairline-strong bg-surface-card px-3 text-button-sm text-ink"
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n} items
              </option>
            ))}
          </select>
        </fieldset>

        <Input
          id={`${id}-focus`}
          label="Focus (optional)"
          value={focus}
          onChange={(event) => setFocus(event.target.value)}
          placeholder="Entropy and the second law"
          maxLength={200}
          autoComplete="off"
          helperText="Leave it empty to draw from the whole subject."
        />

        {practice.error && (
          <Alert tone="danger" onClose={practice.clearError}>
            {practice.error}
          </Alert>
        )}

        <Button type="submit" disabled={practice.making} className="self-start">
          {practice.making ? (
            <>
              <SpinnerIcon />
              Writing them…
            </>
          ) : (
            `Make ${kind === 'questions' ? 'questions' : 'flashcards'}`
          )}
        </Button>
      </form>

      {practice.loading ? (
        <p className="text-body-xs text-mute-strong">Loading…</p>
      ) : (
        practice.sets.map((set, index) => (
          <PracticeSetView
            key={set.id}
            set={set}
            open={index === 0}
            onSeek={onSeek}
            onDelete={() => {
              if (window.confirm('Delete this practice set?')) practice.remove(set.id);
            }}
          />
        ))
      )}
    </div>
  );
}

function PracticeSetView({
  set,
  open,
  onSeek,
  onDelete,
}: {
  set: PracticeSet;
  open: boolean;
  onSeek?: SeekHandler;
  onDelete: () => void;
}) {
  const noun = set.kind === 'questions' ? 'question' : 'flashcard';
  const heading = `${pluralise(set.items.length, noun)}${set.focus ? ` on ${set.focus}` : ''}`;

  return (
    <details open={open} className="group/set rounded-md border border-hairline bg-surface-doc">
      <summary className="flex min-h-12 list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate text-body-sm-strong text-ink">{heading}</span>
        <span className="shrink-0 text-caption-sm text-mute-strong">{formatRelativeTime(set.created_at)}</span>
        <IconButton
          tone="danger"
          aria-label={`Delete ${heading}`}
          onClick={(event) => {
            event.preventDefault();
            onDelete();
          }}
        >
          <TrashIcon />
        </IconButton>
      </summary>
      <ol className="flex flex-col gap-3 border-t border-hairline-soft p-4">
        {set.items.map((item, index) =>
          set.kind === 'flashcards' ? (
            <Flashcard key={index} item={item} onSeek={onSeek} />
          ) : (
            <Question key={index} item={item} number={index + 1} onSeek={onSeek} />
          ),
        )}
      </ol>
    </details>
  );
}

function Question({ item, number, onSeek }: { item: PracticeItem; number: number; onSeek?: SeekHandler }) {
  return (
    <li className="flex flex-col gap-2">
      <p className="text-body-sm text-ink">
        <span className="font-mono text-code-xs tabular-nums text-mute-strong">{number}.</span> {item.question}
      </p>
      <details className="pl-5">
        <summary className="inline-flex min-h-8 cursor-pointer items-center text-caption-md text-ink hover:underline">
          Show answer
        </summary>
        <div className="mt-1 flex flex-col items-start gap-2">
          <p className="text-body-sm text-body">{item.answer}</p>
          <SourceCitation source={item.source} onSeek={onSeek} />
        </div>
      </details>
    </li>
  );
}

function Flashcard({ item, onSeek }: { item: PracticeItem; onSeek?: SeekHandler }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setFlipped((side) => !side)}
        aria-pressed={flipped}
        aria-label={flipped ? `Answer: ${item.back}. Show the question.` : `${item.front}. Show the answer.`}
        className={cn(
          'flex min-h-24 w-full items-center justify-center rounded-md border px-5 py-4 text-center text-body-md transition-transform active:scale-[0.99]',
          flipped ? 'border-ink bg-surface-dark text-on-dark focus-on-dark' : 'border-hairline bg-surface-card text-ink',
        )}
      >
        <span aria-hidden="true">{flipped ? item.back : item.front}</span>
      </button>
      {flipped && (
        <div className="flex justify-end">
          <SourceCitation source={item.source} onSeek={onSeek} />
        </div>
      )}
    </li>
  );
}
