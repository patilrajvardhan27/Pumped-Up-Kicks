import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatBytes } from '@/lib/format';

interface UploadProgressProps {
  percent: number;
  sentBytes: number;
  totalBytes: number | null;
}

export function UploadProgress({ percent, sentBytes, totalBytes }: UploadProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-caption-md text-ink">Uploading</span>
        <span className="font-mono text-code-xs tabular-nums text-mute-strong">
          {formatBytes(sentBytes, 1)} / {totalBytes ? formatBytes(totalBytes, 1) : '-'} ({percent}%)
        </span>
      </div>
      <ProgressBar value={percent} label="Upload progress" busy />
      {/* Always rendered so the message arriving does not shift the form. */}
      <p aria-live="polite" className="min-h-5 text-caption-sm text-mute-strong">
        {percent === 100 ? 'Transfer complete. Starting transcription.' : ''}
      </p>
    </div>
  );
}
