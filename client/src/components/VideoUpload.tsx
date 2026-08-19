'use client';

import { useCallback, useRef, useState } from 'react';
import { videoService } from '@/services';
import Alert from './Alert';

const ACCEPTED = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v'];
const MAX_BYTES = 4 * 1024 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface VideoUploadProps {
  /** Called with the new video's id once the file is on the server. */
  onUploadSuccess?: (videoId: number) => void;
}

export default function VideoUpload({ onUploadSuccess }: VideoUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [percent, setPercent] = useState(0);
  const [sentBytes, setSentBytes] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback((candidate: File) => {
    const ext = candidate.name.slice(candidate.name.lastIndexOf('.')).toLowerCase();

    if (!ACCEPTED.includes(ext)) {
      setError(`${ext || 'That file'} is not a video format we can read. Use ${ACCEPTED.join(', ')}.`);
      return;
    }
    if (candidate.size > MAX_BYTES) {
      setError(`${formatBytes(candidate.size)} is over the 4 GB limit. Trim or compress the recording first.`);
      return;
    }

    setError(null);
    setNotice(null);
    setFile(candidate);
    if (!title) setTitle(candidate.name.replace(/\.[^/.]+$/, ''));
  }, [title]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) accept(dropped);
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setPercent(0);
    setSentBytes(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setNotice(null);
    setPercent(0);

    try {
      const result = await videoService.uploadVideo(file, title, (pct, loaded) => {
        setPercent(pct);
        setSentBytes(loaded);
      });

      setNotice(`${result.filename} is on the server. Transcription has started.`);
      reset();
      onUploadSuccess?.(result.video_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload did not complete.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-lg text-ink">Add a lecture</h3>
        <span className="font-mono text-[0.65rem] text-faint">MP4 · MOV · MKV · WEBM</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Choose a video file, or drop one here"
          className={`cursor-pointer rounded-lg border border-dashed px-5 py-8 text-center transition-colors ${
            dragging
              ? 'border-signal bg-signal/[0.06]'
              : 'border-line hover:border-line-bright bg-well'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(e) => e.target.files?.[0] && accept(e.target.files[0])}
            disabled={uploading}
            className="sr-only"
          />

          {file ? (
            <>
              <p className="truncate font-mono text-sm text-signal">{file.name}</p>
              <p className="mt-1 font-mono text-xs text-faint">{formatBytes(file.size)}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">Drop a recording here, or click to choose one</p>
              <p className="mt-1 font-mono text-xs text-faint">up to 4 GB</p>
            </>
          )}
        </div>

        {file && !uploading && (
          <div>
            <label htmlFor="video-title" className="eyebrow mb-2 block">
              Name it
            </label>
            <input
              id="video-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Week 4 — Backpropagation"
              className="input-field"
            />
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between font-mono text-xs">
              <span className="text-signal">Uploading</span>
              <span className="text-faint">
                {formatBytes(sentBytes)} / {file ? formatBytes(file.size) : '—'} · {percent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="tape-moving h-full rounded-full bg-signal transition-[width] duration-200"
                style={{ width: `${percent}%` }}
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            {percent === 100 && (
              <p className="font-mono text-xs text-faint">
                Transfer complete — starting transcription.
              </p>
            )}
          </div>
        )}

        <button type="submit" disabled={!file || uploading} className="btn-primary w-full">
          {uploading ? `Uploading ${percent}%` : 'Upload and process'}
        </button>
      </form>

      {notice && (
        <div className="mt-4">
          <Alert variant="live" title="Uploaded" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert variant="fault" title="Upload failed" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}
    </section>
  );
}
