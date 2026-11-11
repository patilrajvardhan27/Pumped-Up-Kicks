'use client';

import { useState } from 'react';
import { TextLink } from '@/components/ui/TextLink';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { accountService } from '@/services/accountService';

const CONFIRM = 'DELETE';

interface AccountPanelProps {
  /** Runs after the API has deleted everything: remove the sign-in account, sign out. */
  afterDelete: () => Promise<void>;
}

type Status = { tone: 'success' | 'danger'; text: string } | null;

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'That did not work. Try again.');

/** Download a copy of your data, or delete the account and everything in it. */
export function AccountPanel({ afterDelete }: AccountPanelProps) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const run = async (kind: 'export' | 'delete', action: () => Promise<void>) => {
    setBusy(kind);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      setStatus({ tone: 'danger', text: errorText(err) });
    } finally {
      setBusy(null);
    }
  };

  const exportData = () =>
    run('export', async () => {
      await accountService.exportData();
      setStatus({ tone: 'success', text: 'Your download has started.' });
    });

  const deleteAccount = () =>
    run('delete', async () => {
      await accountService.deleteAccount();
      setStatus({ tone: 'success', text: 'Your lectures, transcripts and chats have been deleted.' });
      await afterDelete();
    });

  return (
    <div className="flex flex-col gap-4">
      {status && (
        <Alert tone={status.tone} title={status.tone === 'success' ? 'Done' : 'Something went wrong'}>
          {status.text}
        </Alert>
      )}

      <Card as="section" aria-labelledby="export-heading" className="flex flex-col items-start gap-3">
        <h2 id="export-heading" className="text-title-sm text-ink-navy">
          Download your data
        </h2>
        <p className="max-w-[60ch] text-body-sm text-slate-gray">
          One JSON file with your account details, every lecture&rsquo;s transcript, and all your chats. Video files
          are not included, since you already have them.
        </p>
        <Button variant="secondary" disabled={busy !== null} onClick={exportData}>
          {busy === 'export' ? 'Preparing…' : 'Download my data'}
        </Button>
      </Card>

      <Card as="section" aria-labelledby="delete-heading" className="flex flex-col items-start gap-3">
        <h2 id="delete-heading" className="text-title-sm text-ink-navy">
          Delete your account
        </h2>
        <p className="max-w-[60ch] text-body-sm text-slate-gray">
          Permanently deletes every lecture, transcript, chat and your account. This cannot be undone. See the{' '}
          <TextLink href="/privacy#retention">
            privacy policy
          </TextLink>{' '}
          for what happens to backups.
        </p>
        <Input
          id="confirm-delete"
          label={`Type ${CONFIRM} to confirm`}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="off"
          className="w-full max-w-xs"
        />
        <Button disabled={confirm !== CONFIRM || busy !== null} onClick={deleteAccount}>
          {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
        </Button>
      </Card>
    </div>
  );
}
