import { AskIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { STARTERS, STUDY_TOOLS } from '@/lib/studyTools';
import type { ChatMode } from '@/types/api';

interface ChatEmptyStateProps {
  hasContent: boolean;
  scoped: boolean;
  scopeLabel: string;
  onAsk: (question: string, mode?: ChatMode) => void;
}

const CHIP = cn(
  'min-h-9 rounded-full border border-hairline-strong px-3.5 text-button-sm text-ink',
  'transition-transform hover:bg-ink hover:text-on-dark active:scale-95',
);

const STEPS = ['Upload a lecture recording', 'Wait for it to show "Ready"', 'Ask anything, or pick a study tool'];

export function ChatEmptyState({ hasContent, scoped, scopeLabel, onAsk }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <span className="flex size-11 items-center justify-center rounded-md bg-surface-dark text-primary">
        <AskIcon className="size-6" />
      </span>
      <p className="eyebrow">{scoped ? `Studying ${scopeLabel}` : 'Start here'}</p>
      <h2 className="text-display-lg text-ink">
        {hasContent ? 'What do you want to know?' : 'Nothing to ask yet.'}
      </h2>

      {!hasContent && (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-body-sm text-body">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {hasContent && scoped && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-body-sm text-body">One click, built from the whole lecture:</p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {STUDY_TOOLS.map((tool) => (
              <li key={tool.mode}>
                <button
                  type="button"
                  onClick={() => onAsk(tool.label, tool.mode)}
                  className="flex w-full flex-col items-start rounded-md border border-hairline-strong px-3.5 py-2.5 text-left transition-transform hover:border-ink active:scale-[0.98]"
                >
                  <span className="text-button-sm text-ink">{tool.short}</span>
                  <span className="text-caption-sm text-mute-strong">{tool.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasContent && (
        <>
          <p className="mt-2 max-w-[60ch] text-body-sm text-body">
            Or type a question. Every answer links to the moment it came from in {scopeLabel}.
            {!scoped && ' Pick a lecture on the left for revision notes, key terms and quizzes.'}
          </p>
          <ul className="flex flex-wrap gap-2">
            {STARTERS.map((starter) => (
              <li key={starter}>
                <button type="button" onClick={() => onAsk(starter)} className={CHIP}>
                  {starter}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
