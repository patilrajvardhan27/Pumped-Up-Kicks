'use client';

import { useId, useState, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { CloseIcon, PageIcon, PlayIcon, SearchIcon } from '@/components/ui/icons';
import { formatClock, pluralise } from '@/lib/format';
import { safeUrl } from '@/lib/timestamps';
import { ApiError } from '@/services/api';
import { studyService } from '@/services/studyService';
import type { SearchHit } from '@/types/api';
import type { SeekHandler } from '@/types/chat';

interface SearchCardProps {
  /** Which part of the library to search: one subject, Unsorted, or everything. */
  scope: { workspaceId?: number | null; unsorted?: boolean };
  label: string;
  onSeek: SeekHandler;
}

/** The server marks matches with ⟦ and ⟧ in plain text; these become <mark>s, never HTML. */
function highlighted(snippet: string): ReactNode[] {
  return snippet.split(/(⟦[^⟧]*⟧)/).map((part, index) =>
    part.startsWith('⟦') && part.endsWith('⟧') ? (
      <mark key={index} className="rounded-xs bg-accent-blue-soft px-0.5 text-ink">
        {part.slice(1, -1)}
      </mark>
    ) : (
      part
    ),
  );
}

/** Full-text search across the open subject's transcripts and course documents. */
export function SearchCard({ scope, label, onSeek }: SearchCardProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const q = query.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      setHits(await studyService.search(q, scope));
      setSearched(q);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Search did not complete. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    setQuery('');
    setHits(null);
    setSearched('');
  };

  return (
    <Card as="section" padding="tile" aria-label={`Search ${label}`} className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor={`${id}-q`} className="sr-only">
          Search {label}
        </label>
        <span className="relative flex min-w-0 flex-1 items-center">
          <SearchIcon className="pointer-events-none absolute left-3 size-4 text-mute-strong" />
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label}`}
            maxLength={200}
            autoComplete="off"
            className="h-10 w-full rounded-md border border-hairline-strong bg-surface-card pr-3 pl-9 text-body-md text-ink placeholder:text-mute-strong focus-visible:border-accent-blue"
          />
        </span>
        {hits !== null && (
          <IconButton aria-label="Clear search" onClick={clear}>
            <CloseIcon />
          </IconButton>
        )}
      </form>

      {error && <Alert tone="danger">{error}</Alert>}

      <div aria-live="polite">
        {busy ? (
          <p className="text-caption-sm text-mute-strong">Searching…</p>
        ) : hits === null ? null : hits.length === 0 ? (
          <p className="text-body-xs text-body">Nothing in {label} matches &ldquo;{searched}&rdquo;.</p>
        ) : (
          <>
            <p className="mb-2 text-caption-sm text-mute-strong">{pluralise(hits.length, 'match')}</p>
            <ul className="flex flex-col gap-2">
              {hits.map((hit) => (
                <li key={hit.chunk_id}>
                  <Hit hit={hit} onSeek={onSeek} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

function Hit({ hit, onSeek }: { hit: SearchHit; onSeek: SeekHandler }) {
  const where = hit.kind === 'video' ? formatClock(hit.start ?? 0) : hit.page_label || 'Document';
  const body = (
    <>
      <span className="flex items-center gap-2">
        {hit.kind === 'video' ? <PlayIcon className="size-3 text-mute-strong" /> : <PageIcon className="size-3.5 text-mute-strong" />}
        <span className="min-w-0 flex-1 truncate text-body-xs text-ink">{hit.title}</span>
        <span className="shrink-0 font-mono text-code-xs tabular-nums text-mute-strong">{where}</span>
      </span>
      <span className="mt-1 block text-caption-sm text-body">{highlighted(hit.snippet)}</span>
    </>
  );
  const box = 'block w-full rounded-md border border-hairline bg-surface-doc p-3 text-left hover:border-hairline-strong';

  if (hit.kind === 'video' && typeof hit.video_id === 'number') {
    return (
      <button type="button" className={box} onClick={() => onSeek(hit.video_id as number, hit.start ?? 0)}>
        {body}
      </button>
    );
  }
  const href = safeUrl(hit.url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${box} no-underline`}>
      {body}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <div className={box}>{body}</div>
  );
}
