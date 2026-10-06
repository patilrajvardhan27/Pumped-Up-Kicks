'use client';

import { useRef } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { UploadIcon } from '@/components/ui/icons';
import { ACCEPTED_EXTENSIONS, useVideoUpload } from '@/hooks/useVideoUpload';
import { DropZone } from './DropZone';
import { UploadProgress } from './UploadProgress';

const TITLE_MAX_CHARS = 200;

interface VideoUploadProps {
  /** Called with the new video's id once the file is on the server. */
  onUploadSuccess?: (videoId: number) => void;
}

export function VideoUpload({ onUploadSuccess }: VideoUploadProps) {
  const upload = useVideoUpload(onUploadSuccess);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const succeeded = await upload.upload();
    if (succeeded && inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card as="section" padding="tile" aria-labelledby="upload-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="upload-heading" className="flex items-center gap-2 text-heading-sm text-ink">
          <UploadIcon className="size-5" />
          Add a lecture
        </h2>
        <span className="text-caption-sm text-mute-strong">MP4, MOV, MKV, WEBM</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <DropZone
          inputRef={inputRef}
          file={upload.file}
          accept={ACCEPTED_EXTENSIONS}
          disabled={upload.uploading}
          onFile={upload.choose}
        />

        {upload.file && !upload.uploading && (
          <Input
            id="video-title"
            name="title"
            label="Name it"
            value={upload.title}
            onChange={(event) => upload.setTitle(event.target.value)}
            placeholder="Week 4: Backpropagation…"
            autoComplete="off"
            maxLength={TITLE_MAX_CHARS}
            helperText={`Up to ${TITLE_MAX_CHARS} characters. Leave it as is to use the file name.`}
          />
        )}

        {upload.uploading && (
          <UploadProgress
            percent={upload.percent}
            sentBytes={upload.sentBytes}
            totalBytes={upload.file?.size ?? null}
          />
        )}

        <Button type="submit" block disabled={!upload.file || upload.uploading}>
          {upload.uploading ? `Uploading ${upload.percent}%` : 'Upload and process'}
        </Button>
      </form>

      {upload.notice && (
        <Alert tone="success" title="Uploaded" onClose={upload.clearNotice}>
          {upload.notice}
        </Alert>
      )}

      {upload.error && (
        <Alert tone="danger" title="Upload failed" onClose={upload.clearError}>
          {upload.error}
        </Alert>
      )}
    </Card>
  );
}
