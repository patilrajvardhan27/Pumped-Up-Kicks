'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useCanvasCourses, type useCanvas } from '@/hooks/useCanvas';
import type { CanvasReturn } from '@/lib/canvasReturn';
import { formatRelativeTime, pluralise } from '@/lib/format';
import type { CanvasCourse, CanvasStatus, CanvasSyncRequest, WorkspaceInfo } from '@/types/api';

type Canvas = ReturnType<typeof useCanvas>;

interface CanvasDialogProps {
  open: boolean;
  onClose: () => void;
  canvas: Canvas;
  workspaces: WorkspaceInfo[];
  /** Set when the browser has just come back from the Canvas sign-in. */
  returned: CanvasReturn | null;
}

const WHAT_COMES_IN =
  'Files (PDF, PowerPoint and Word), pages, the syllabus, announcements and assignment due dates come into your subjects. Quizzes, grades and submissions never do.';

/** Connect Canvas, choose which course feeds which subject, sync, disconnect. */
export function CanvasDialog({ open, onClose, canvas, workspaces, returned }: CanvasDialogProps) {
  const { status } = canvas;

  return (
    <Dialog open={open} onClose={onClose} title="Canvas">
      <div className="flex flex-col gap-5">
        {returned?.outcome === 'connected' && status?.connected && (
          <Alert tone="success" title="Canvas connected">
            Choose which courses to import, then sync.
          </Alert>
        )}
        {returned?.outcome === 'denied' && (
          <Alert tone="info" title="Canvas wasn't connected">
            You didn&rsquo;t allow access in Canvas. Nothing was imported.
          </Alert>
        )}
        {returned?.outcome === 'error' && (
          <Alert tone="danger" title="Canvas wasn't connected">
            {returned.reason || 'The sign-in did not complete. Try again.'}
          </Alert>
        )}
        {canvas.error && (
          <Alert tone="danger" onClose={canvas.clearError}>
            {canvas.error}
          </Alert>
        )}

        {status === null ? (
          <p className="text-body-xs text-mute-strong">Loading…</p>
        ) : status.connected ? (
          <Connected status={status} canvas={canvas} workspaces={workspaces} open={open} />
        ) : (
          <Connect status={status} canvas={canvas} />
        )}
      </div>
    </Dialog>
  );
}

function Connect({ status, canvas }: { status: CanvasStatus; canvas: Canvas }) {
  const id = useId();
  const [address, setAddress] = useState(status.schools.length === 1 ? status.schools[0] : '');
  const [devAddress, setDevAddress] = useState('');
  const [token, setToken] = useState('');
  const available = status.schools.length > 0;

  return (
    <>
      <p className="text-body-sm text-body">{WHAT_COMES_IN}</p>

      {available ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (address.trim()) canvas.signIn(address.trim());
          }}
          className="flex flex-col gap-3"
        >
          <Input
            id={`${id}-school`}
            label="Your school's Canvas address"
            list={`${id}-schools`}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="https://canvas.yourschool.edu"
            autoComplete="url"
            inputMode="url"
            helperText="You sign in on your school's Canvas, and this app gets read-only access."
          />
          <datalist id={`${id}-schools`}>
            {status.schools.map((school) => (
              <option key={school} value={school} />
            ))}
          </datalist>
          <Button type="submit" disabled={!address.trim() || canvas.busy} className="self-start">
            Continue to Canvas
          </Button>
        </form>
      ) : (
        <Alert tone="info" title="Not set up yet">
          Canvas access has to be enabled for your school first: its Canvas admin creates a developer key
          for this app. Until then, nothing can be imported.
        </Alert>
      )}

      {status.personal_tokens_allowed && (
        <details className="rounded-md border border-hairline bg-surface-card p-4">
          <summary className="text-caption-md text-ink">Use a personal access token (local development)</summary>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (await canvas.connectWithToken(devAddress.trim(), token.trim())) setToken('');
            }}
            className="mt-4 flex flex-col gap-3"
          >
            <Input
              id={`${id}-dev-school`}
              label="Canvas address"
              value={devAddress}
              onChange={(event) => setDevAddress(event.target.value)}
              placeholder="https://canvas.yourschool.edu"
              autoComplete="off"
            />
            <Input
              id={`${id}-token`}
              label="Access token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              helperText="For testing on your own machine only. Never ask other people for theirs."
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!devAddress.trim() || token.trim().length < 10 || canvas.busy}
              className="self-start"
            >
              Connect
            </Button>
          </form>
        </details>
      )}
    </>
  );
}

const SKIP = 'skip';
const NEW = 'new';

function Connected({
  status,
  canvas,
  workspaces,
  open,
}: {
  status: CanvasStatus;
  canvas: Canvas;
  workspaces: WorkspaceInfo[];
  open: boolean;
}) {
  const id = useId();
  // Reloaded after each sync, since a sync can create subjects and change links.
  const { courses, error } = useCanvasCourses(open && status.connected, status.sync?.finished_at);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [deleteMaterial, setDeleteMaterial] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sync = status.sync;
  const running = sync?.stage === 'queued' || sync?.stage === 'syncing';

  const choiceFor = (course: CanvasCourse) =>
    choices[course.id] ?? (course.workspace_id != null ? String(course.workspace_id) : NEW);

  const submit = () => {
    const request: Required<CanvasSyncRequest> = { link: [], unlink: [] };
    const targets = new Set<string>();
    for (const course of courses ?? []) {
      const choice = choiceFor(course);
      if (choice !== SKIP && choice !== NEW) {
        if (targets.has(choice)) {
          setProblem('Two courses are going into the same subject. Give each course its own subject.');
          return;
        }
        targets.add(choice);
      }
      if (choice === SKIP) {
        if (course.workspace_id != null) request.unlink.push(course.id);
      } else if (choice === NEW) {
        if (course.workspace_id == null) request.link.push({ course_id: course.id, workspace_id: null });
      } else if (Number(choice) !== course.workspace_id) {
        request.link.push({ course_id: course.id, workspace_id: Number(choice) });
      }
    }
    setProblem(null);
    canvas.sync(request);
  };

  return (
    <>
      <p className="text-body-sm text-body">
        Connected to <span className="font-bold text-ink">{status.base_url?.replace('https://', '')}</span>
        {status.auth_type === 'personal_token' ? ' with a development token.' : '.'} {WHAT_COMES_IN}
      </p>

      <SyncState status={status} />

      <section aria-labelledby={`${id}-courses`} className="flex flex-col gap-3">
        <h3 id={`${id}-courses`} className="text-caption-md text-ink">
          Your courses this term
        </h3>
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : courses === null ? (
          <p className="text-body-xs text-mute-strong">Loading your courses…</p>
        ) : courses.length === 0 ? (
          <p className="text-body-xs text-body">Canvas lists no active courses where you are a student.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline-soft rounded-md border border-hairline bg-surface-card">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor={`${id}-course-${course.id}`} className="min-w-0">
                  <span className="block truncate text-body-xs text-ink">{course.name}</span>
                  {course.term && <span className="block text-caption-sm text-mute-strong">{course.term}</span>}
                </label>
                <select
                  id={`${id}-course-${course.id}`}
                  value={choiceFor(course)}
                  disabled={running}
                  onChange={(event) => setChoices((prev) => ({ ...prev, [course.id]: event.target.value }))}
                  className="h-9 w-full min-w-0 rounded-sm border border-hairline-strong bg-surface-card px-2 text-caption-sm text-ink sm:w-56"
                >
                  {course.workspace_id == null && <option value={NEW}>New subject</option>}
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={String(workspace.id)}>
                      Into {workspace.name}
                    </option>
                  ))}
                  <option value={SKIP}>Don&rsquo;t import</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        {problem && <Alert tone="danger">{problem}</Alert>}
        <Button onClick={submit} disabled={running || canvas.busy || !courses?.length} className="self-start">
          {running ? 'Syncing…' : 'Import and sync'}
        </Button>
      </section>

      <section aria-labelledby={`${id}-disconnect`} className="flex flex-col gap-3 border-t border-hairline-soft pt-5">
        <h3 id={`${id}-disconnect`} className="text-caption-md text-ink">
          Disconnect
        </h3>
        <p className="text-body-xs text-body">
          Deletes the stored Canvas sign-in. Your subjects stay; imported material stays too unless you
          choose otherwise.
        </p>
        <label className="flex items-center gap-2 text-body-xs text-ink">
          <input
            type="checkbox"
            checked={deleteMaterial}
            onChange={(event) => setDeleteMaterial(event.target.checked)}
            className="size-4 accent-ink"
          />
          Also delete everything imported from Canvas
        </label>
        <Button
          variant="secondary"
          disabled={running || canvas.busy}
          onClick={() => {
            const confirmed = window.confirm(
              deleteMaterial
                ? 'Disconnect Canvas and delete every imported file, page and deadline?'
                : 'Disconnect Canvas? Imported material stays in your subjects.',
            );
            if (confirmed) canvas.disconnect(deleteMaterial);
          }}
          className="self-start"
        >
          Disconnect Canvas
        </Button>
      </section>
    </>
  );
}

function SyncState({ status }: { status: CanvasStatus }) {
  const sync = status.sync;
  if (!sync || sync.stage === 'idle') {
    return <p className="text-body-xs text-mute-strong">Nothing imported yet.</p>;
  }

  if (sync.stage === 'queued' || sync.stage === 'syncing') {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <ProgressBar value={Math.max(3, sync.progress)} label="Canvas sync progress" busy />
        <p className="truncate text-caption-sm text-body">{sync.detail || 'Starting…'}</p>
      </div>
    );
  }

  if (sync.stage === 'failed') {
    return (
      <Alert tone="danger" title="The last sync failed">
        {sync.error || 'Try again in a moment.'}
      </Alert>
    );
  }

  const summary = sync.summary;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-hairline bg-surface-card p-4" aria-live="polite">
      <p className="text-body-xs text-ink">
        Synced {sync.finished_at ? formatRelativeTime(sync.finished_at) : 'just now'}.
      </p>
      {summary && (
        <p className="font-mono text-code-xs tabular-nums text-mute-strong">
          {summary.added} new, {summary.updated} changed, {summary.unchanged} unchanged, {summary.removed} removed,{' '}
          {pluralise(summary.deadlines, 'due date')}
        </p>
      )}
      {summary && summary.skipped.length > 0 && (
        <details>
          <summary className="text-caption-sm text-ink">{pluralise(summary.skipped.length, 'item')} not imported</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-caption-sm text-body">
            {summary.skipped.map((note) => (
              <li key={note} className="break-words">
                {note}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
