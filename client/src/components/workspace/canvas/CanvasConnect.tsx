'use client';

import { useId, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { useCanvas } from '@/hooks/useCanvas';
import type { CanvasStatus } from '@/types/api';

export type Canvas = ReturnType<typeof useCanvas>;

export const WHAT_COMES_IN =
  'Files (PDF, PowerPoint and Word), pages, the syllabus, announcements and assignment due dates come into your subjects. Quizzes, grades and submissions never do.';

/** Not connected yet: sign in on the school's Canvas, or (locally) paste a personal token. */
export function CanvasConnect({ status, canvas }: { status: CanvasStatus; canvas: Canvas }) {
  const id = useId();
  const [address, setAddress] = useState(status.schools.length === 1 ? status.schools[0] : '');
  const [devAddress, setDevAddress] = useState('');
  const [token, setToken] = useState('');
  const available = status.schools.length > 0;

  return (
    <>
      <p className="text-body-sm text-slate-gray">{WHAT_COMES_IN}</p>

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
        <details className="rounded-lg border border-hairline bg-paper p-4">
          <summary className="text-label text-ink-navy">Use a personal access token (local development)</summary>
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
