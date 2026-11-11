import { AskIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import type { ChatScope } from '@/types/api';

interface ChatEmptyStateProps {
  hasContent: boolean;
  scope: ChatScope;
  scopeLabel: string;
  onAsk: (question: string) => void;
}

const PROMPT: Record<ChatScope, string> = {
  video: 'Ask the lecture something.',
  workspace: 'Ask this subject something.',
  all: 'Ask your lectures something.',
};

const STARTERS = [
  'Summarise the main argument',
  'What were the limitations?',
  'List every example worked through',
];

export function ChatEmptyState({ hasContent, scope, scopeLabel, onAsk }: ChatEmptyStateProps) {
  const scoped = scope !== 'all';

  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <span className="flex size-11 items-center justify-center rounded-lg bg-ink-navy text-mist-gray">
        <AskIcon className="size-6" />
      </span>
      <h2 className="text-title text-ink-navy">
        {hasContent ? PROMPT[scope] : 'Nothing to ask yet.'}
      </h2>
      <p className="measure text-body-sm text-slate-gray">
        {hasContent
          ? `Answers come back with the timestamp they were drawn from. This chat searches ${scopeLabel}.`
          : `Add a lecture to ${scoped ? scopeLabel : 'your library'}. Once it finishes processing, every word of it becomes searchable.`}
      </p>

      {hasContent && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {STARTERS.map((starter) => (
            <li key={starter}>
              <button
                type="button"
                onClick={() => onAsk(starter)}
                className={cn(
                  'min-h-11 rounded-full border border-hairline px-3.5 text-button-sm text-ink-navy sm:min-h-9',
                  'transition-transform hover:bg-ink-navy hover:text-paper active:translate-y-px',
                )}
              >
                {starter}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
