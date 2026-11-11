'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { FIELD } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useCanvasCourses } from '@/hooks/useCanvas';
import { formatRelativeTime, pluralise } from '@/lib/format';
import type { CanvasCourse, CanvasStatus, CanvasSyncRequest, WorkspaceInfo } from '@/types/api';
import { WHAT_COMES_IN, type Canvas } from './CanvasConnect';

/** Connected: choose which course feeds which subject, sync, and disconnect. */
const SKIP = 'skip';
const NEW = 'new';

export function CanvasConnected({
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
      <p className="text-body-sm text-slate-gray">
        Connected to <span className="text-label text-ink-navy">{status.base_url?.replace('https://', '')}</span>
        {status.auth_type === 'personal_token' ? ' with a development token.' : '.'} {WHAT_COMES_IN}
      </p>

      <SyncState status={status} />

      <section aria-labelledby={`${id}-courses`} className="flex flex-col gap-3">
        <h3 id={`${id}-courses`} className="text-label text-ink-navy">
          Your courses this term
        </h3>
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : courses === null ? (
          <SkeletonRows label="Loading your courses" rows={3} rowClassName="h-12" />
        ) : courses.length === 0 ? (
          <p className="text-body-sm text-slate-gray">Canvas lists no active courses where you are a student.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-pebble rounded-lg border border-hairline bg-paper">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor={`${id}-course-${course.id}`} className="min-w-0">
                  <span className="block truncate text-body-sm text-ink-navy">{course.name}</span>
                  {course.term && <span className="block text-caption text-slate-gray">{course.term}</span>}
                </label>
                <select
                  id={`${id}-course-${course.id}`}
                  value={choiceFor(course)}
                  disabled={running}
                  onChange={(event) => setChoices((prev) => ({ ...prev, [course.id]: event.target.value }))}
                  className={cn(FIELD, 'h-10 w-full min-w-0 px-2 text-label sm:w-56')}
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

      <section aria-labelledby={`${id}-disconnect`} className="flex flex-col gap-3 border-t border-pebble pt-5">
        <h3 id={`${id}-disconnect`} className="text-label text-ink-navy">
          Disconnect
        </h3>
        <p className="text-body-sm text-slate-gray">
          Deletes the stored Canvas sign-in. Your subjects stay; imported material stays too unless you
          choose otherwise.
        </p>
        <label className="flex items-center gap-2 text-body-sm text-ink-navy">
          <input
            type="checkbox"
            checked={deleteMaterial}
            onChange={(event) => setDeleteMaterial(event.target.checked)}
            className="size-4 accent-signal-blue"
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
    return <p className="text-body-sm text-slate-gray">Nothing imported yet.</p>;
  }

  if (sync.stage === 'queued' || sync.stage === 'syncing') {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <ProgressBar value={Math.max(3, sync.progress)} label="Canvas sync progress" busy />
        <p className="truncate text-caption text-slate-gray">{sync.detail || 'Starting…'}</p>
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
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-paper p-4" aria-live="polite">
      <p className="text-body-sm text-ink-navy">
        Synced {sync.finished_at ? formatRelativeTime(sync.finished_at) : 'just now'}.
      </p>
      {summary && (
        <p className="tabular-nums text-caption text-slate-gray">
          {summary.added} new, {summary.updated} changed, {summary.unchanged} unchanged, {summary.removed} removed,{' '}
          {pluralise(summary.deadlines, 'due date')}
        </p>
      )}
      {summary && summary.skipped.length > 0 && (
        <details>
          <summary className="text-caption text-ink-navy">{pluralise(summary.skipped.length, 'item')} not imported</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-caption text-slate-gray">
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
