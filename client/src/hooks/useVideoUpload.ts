'use client';

import { useCallback, useState } from 'react';
import { track } from '@/lib/analytics';
import { formatBytes } from '@/lib/format';
import { videoService } from '@/services/videoService';

export const ACCEPTED_EXTENSIONS = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.m4v'];
const MAX_BYTES = 4 * 1024 * 1024 * 1024;

/** Returns why a file cannot be uploaded, or null when it can. */
function rejectionFor(candidate: File): string | null {
  const dot = candidate.name.lastIndexOf('.');
  const ext = dot === -1 ? '' : candidate.name.slice(dot).toLowerCase();

  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `${ext || 'That file'} is not a video format we can read. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`;
  }
  if (candidate.size > MAX_BYTES) {
    return `${formatBytes(candidate.size, 1)} is over the 4\u00a0GB limit. Trim or compress the recording first.`;
  }
  return null;
}

/** File choice, client-side checks and the upload itself. */
export function useVideoUpload(onUploadSuccess?: (videoId: number) => void) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [percent, setPercent] = useState(0);
  const [sentBytes, setSentBytes] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = useCallback(
    (candidate: File) => {
      const rejection = rejectionFor(candidate);
      if (rejection) {
        setError(rejection);
        return;
      }
      setError(null);
      setNotice(null);
      setFile(candidate);
      if (!title) setTitle(candidate.name.replace(/\.[^/.]+$/, ''));
    },
    [title],
  );

  /** Resolves true once the file is on the server. */
  const upload = useCallback(async (): Promise<boolean> => {
    if (!file) return false;

    setUploading(true);
    setError(null);
    setNotice(null);
    setPercent(0);

    try {
      const result = await videoService.uploadVideo(file, title.trim(), (pct, loaded) => {
        setPercent(pct);
        setSentBytes(loaded);
      });

      setNotice(`${result.filename} is on the server. Transcription has started.`);
      setFile(null);
      setTitle('');
      setPercent(0);
      setSentBytes(0);
      track('lecture_uploaded', { size_mb: Math.round(file.size / 1024 ** 2) });
      onUploadSuccess?.(result.video_id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The upload did not complete.');
      return false;
    } finally {
      setUploading(false);
    }
  }, [file, title, onUploadSuccess]);

  return {
    file,
    title,
    setTitle,
    percent,
    sentBytes,
    uploading,
    notice,
    error,
    choose,
    upload,
    clearNotice: useCallback(() => setNotice(null), []),
    clearError: useCallback(() => setError(null), []),
  };
}
